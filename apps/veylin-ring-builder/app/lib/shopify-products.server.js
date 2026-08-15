import crypto from "node:crypto";
import prisma from "../db.server.js";
import { ringBuilderConfig } from "./config.server.js";
import { shopifyNumericId } from "./validation.js";

const PRODUCT_CREATE = `#graphql
  mutation RingBuilderProductCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        handle
        variants(first: 1) { nodes { id } }
      }
      userErrors { field message }
    }
  }
`;

const VARIANT_UPDATE = `#graphql
  mutation RingBuilderVariantUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price }
      userErrors { field message }
    }
  }
`;

const PUBLICATIONS = `#graphql
  query RingBuilderPublications {
    publications(first: 50) { nodes { id catalog { title } } }
  }
`;

const PUBLISH = `#graphql
  mutation RingBuilderPublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

const SETTING_VARIANT = `#graphql
  query RingBuilderSettingVariant($id: ID!) {
    productVariant(id: $id) {
      id
      availableForSale
      product { id status }
    }
  }
`;

function errors(payload, path) {
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  const value = path.reduce((current, key) => current?.[key], payload.data);
  if (value?.userErrors?.length) {
    throw new Error(value.userErrors.map((error) => error.message).join("; "));
  }
  return value;
}

async function graph(admin, query, variables, path) {
  const response = await admin.graphql(query, { variables });
  return errors(await response.json(), path);
}

function titleFor(diamond) {
  const certificate = diamond.certificate;
  const pieces = [
    certificate.carats ? `${certificate.carats} ct` : null,
    certificate.shape,
    certificate.color,
    certificate.clarity,
    "Diamond",
  ];
  return pieces.filter(Boolean).join(" ");
}

async function updateVariant(admin, mapping, diamond) {
  await graph(
    admin,
    VARIANT_UPDATE,
    {
      productId: mapping.productId,
      variants: [
        {
          id: mapping.variantId,
          price: diamond.price,
          inventoryPolicy: "CONTINUE",
        },
      ],
    },
    ["productVariantsBulkUpdate"],
  );
}

async function publish(admin, productId) {
  const response = await admin.graphql(PUBLICATIONS);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  const publication = payload.data?.publications?.nodes?.find(
    (item) => item.catalog?.title === "Online Store",
  );
  if (!publication) throw new Error("Online Store publication is unavailable");
  await graph(
    admin,
    PUBLISH,
    { id: productId, input: [{ publicationId: publication.id }] },
    ["publishablePublish"],
  );
}

async function createProduct(admin, diamond) {
  const hash = crypto.createHash("sha256").update(diamond.offerId).digest("hex").slice(0, 16);
  const media = diamond.image
    ? [
        {
          originalSource: diamond.image,
          mediaContentType: "IMAGE",
          alt: titleFor(diamond),
        },
      ]
    : [];
  const product = await graph(
    admin,
    PRODUCT_CREATE,
    {
      product: {
        title: titleFor(diamond),
        handle: `veylin-nivoda-${hash}`,
        descriptionHtml: "<p>Diamond selected through the Veylin Ring Builder.</p>",
        productType: "Loose Diamond",
        vendor: "Nivoda",
        status: "ACTIVE",
        tags: ["_veylin_ring_builder", "_nivoda_diamond"],
        metafields: [
          {
            namespace: "$app",
            key: "nivoda_offer_id",
            value: diamond.offerId,
          },
          {
            namespace: "$app",
            key: "nivoda_diamond_id",
            value: diamond.diamondId,
          },
          {
            namespace: "$app",
            key: "nivoda_snapshot",
            value: JSON.stringify(diamond),
          },
          {
            namespace: "seo",
            key: "hidden",
            type: "number_integer",
            value: "1",
          },
        ],
      },
      media,
    },
    ["productCreate"],
  );
  const variantId = product.product?.variants?.nodes?.[0]?.id;
  if (!variantId) throw new Error("Shopify created no diamond variant");
  const mapping = { productId: product.product.id, variantId };
  await updateVariant(admin, mapping, diamond);
  await publish(admin, product.product.id);
  return mapping;
}

export async function assertSettingAvailable(admin, numericVariantId) {
  const gid = `gid://shopify/ProductVariant/${numericVariantId}`;
  const response = await admin.graphql(SETTING_VARIANT, { variables: { id: gid } });
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors[0].message);
  const variant = payload.data?.productVariant;
  if (!variant || !variant.availableForSale || variant.product.status !== "ACTIVE") {
    throw new Response("That ring setting is no longer available", { status: 409 });
  }
}

export async function ensureDiamondVariant({ admin, shop, diamond }) {
  const config = ringBuilderConfig();
  let mapping = await prisma.diamondVariant.findUnique({
    where: { shop_offerId: { shop, offerId: diamond.offerId } },
  });

  if (mapping) {
    try {
      await updateVariant(admin, mapping, diamond);
    } catch {
      await prisma.diamondVariant.delete({ where: { id: mapping.id } });
      mapping = null;
    }
  }

  if (!mapping) {
    const created = await createProduct(admin, diamond);
    mapping = await prisma.diamondVariant.create({
      data: {
        shop,
        offerId: diamond.offerId,
        diamondId: diamond.diamondId,
        productId: created.productId,
        variantId: created.variantId,
        price: diamond.price,
        currency: diamond.currency,
        snapshot: JSON.stringify(diamond),
        expiresAt: new Date(Date.now() + config.variantTtlMinutes * 60 * 1000),
      },
    });
  } else {
    mapping = await prisma.diamondVariant.update({
      where: { id: mapping.id },
      data: {
        diamondId: diamond.diamondId,
        price: diamond.price,
        currency: diamond.currency,
        snapshot: JSON.stringify(diamond),
        expiresAt: new Date(Date.now() + config.variantTtlMinutes * 60 * 1000),
      },
    });
  }

  return { ...mapping, numericVariantId: shopifyNumericId(mapping.variantId) };
}
