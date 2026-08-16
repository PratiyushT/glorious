import { shopifyNumericId } from "./validation.js";

const LIST_COLLECTIONS = `#graphql
  query RingBuilderCollections {
    collections(first: 100, sortKey: TITLE) {
      nodes {
        id
        title
        handle
      }
    }
  }
`;

const SETTING_COLLECTION = `#graphql
  query RingBuilderSettingCollection($id: ID!, $productLimit: Int!) {
    shop {
      currencyCode
    }
    collection(id: $id) {
      id
      title
      products(first: $productLimit, sortKey: TITLE) {
        nodes {
        id
        title
        handle
        vendor
        description
        featuredImage {
          url
          altText
          width
          height
        }
        media(first: 10) {
          nodes {
            mediaContentType
            alt
            preview {
              image {
                url
                altText
                width
                height
              }
            }
            ... on MediaImage {
              image {
                url
                altText
                width
                height
              }
            }
            ... on Video {
              sources {
                url
                format
                mimeType
                width
                height
              }
            }
          }
        }
        variants(first: 100) {
          nodes {
            id
            title
            availableForSale
            price
            compareAtPrice
            selectedOptions {
              name
              value
            }
            image {
              url
              altText
                width
                height
              }
            }
          }
        }
      }
    }
  }
`;

async function graph(client, query, variables = {}) {
  const response = await client.graphql(query, { variables });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

export async function listSettingCollections(admin) {
  const data = await graph(admin, LIST_COLLECTIONS);
  return data.collections.nodes;
}

export function normalizeSettingCollection(collection, shopCurrency = "USD") {
  if (!collection) return null;

  const items = collection.products.nodes.flatMap((product) => {
    const media = (product.media?.nodes || []).flatMap((item) => {
      const image = item.image || item.preview?.image || null;
      if (item.mediaContentType === "VIDEO") {
        const source = (item.sources || []).find((entry) => entry.format === "mp4")
          || (item.sources || [])[0];
        if (!source?.url) return [];
        return [{
          type: "video",
          url: source.url,
          mimeType: source.mimeType || "video/mp4",
          width: source.width,
          height: source.height,
          preview: image,
          altText: item.alt || image?.altText || product.title,
        }];
      }
      if (!image?.url) return [];
      return [{
        type: "image",
        ...image,
        altText: item.alt || image.altText || product.title,
      }];
    });

    const variants = product.variants.nodes
      .filter((variant) => variant.availableForSale)
      .map((variant) => {
        const image = variant.image || product.featuredImage;
        const price = typeof variant.price === "object"
          ? variant.price.amount
          : String(variant.price);
        const currency = typeof variant.price === "object"
          ? variant.price.currencyCode
          : shopCurrency;
        return {
          id: shopifyNumericId(variant.id),
          title: variant.title,
          price,
          currency,
          compareAtPrice: variant.compareAtPrice == null
            ? null
            : typeof variant.compareAtPrice === "object"
              ? variant.compareAtPrice.amount
              : String(variant.compareAtPrice),
          selectedOptions: variant.selectedOptions || [],
          image,
        };
      });

    if (variants.length === 0) return [];
    return [{
      id: product.id,
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      description: product.description || "",
      image: product.featuredImage,
      media: media.length
        ? media
        : product.featuredImage
          ? [{ type: "image", ...product.featuredImage }]
          : [],
      variants,
    }];
  });

  return { id: collection.id, title: collection.title, items };
}

export async function getSettingCollection(admin, collectionId, productLimit = 24) {
  const data = await graph(admin, SETTING_COLLECTION, {
    id: collectionId,
    productLimit,
  });
  return normalizeSettingCollection(data.collection, data.shop.currencyCode);
}
