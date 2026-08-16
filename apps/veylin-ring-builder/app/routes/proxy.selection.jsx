import crypto from "node:crypto";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { assertAllowedShop, ringBuilderConfig } from "../lib/config.server";
import { getDiamond } from "../lib/nivoda.server";
import {
  assertSettingAvailable,
  ensureDiamondVariant,
} from "../lib/shopify-products.server";
import {
  normalizeSupplierOrderTarget,
  supplierOrderCartProperty,
} from "../lib/supplier-order-targets";
import { CURRENCIES, parseSelection } from "../lib/validation";

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.public.appProxy(request);
  if (!session || !admin) {
    return Response.json({ error: "App installation required" }, { status: 401 });
  }
  const config = ringBuilderConfig();
  assertAllowedShop(session.shop, config);

  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const selection = parseSelection(input);
    const requestedCurrency = String(input.currency || "USD").toUpperCase();
    const currency = CURRENCIES.includes(requestedCurrency) ? requestedCurrency : "USD";
    const shopConfig = await prisma.shopConfiguration.findUnique({
      where: { shop: session.shop },
    });
    const supplierOrderTarget = normalizeSupplierOrderTarget(
      shopConfig?.supplierOrderTarget,
    );
    await assertSettingAvailable(admin, selection.settingVariantId);
    const diamond = await getDiamond(selection.diamondId, currency, config);
    if (diamond.availability !== "AVAILABLE" || diamond.offerId !== selection.offerId) {
      return Response.json(
        { error: "That diamond is no longer available. Choose another stone." },
        { status: 409 },
      );
    }

    const mapping = await ensureDiamondVariant({
      admin,
      shop: session.shop,
      diamond,
    });
    const bundleId = crypto.randomUUID();
    const certificate = diamond.certificate;
    const description = [
      certificate.carats ? `${certificate.carats} ct` : null,
      certificate.shape,
      certificate.color,
      certificate.clarity,
    ].filter(Boolean).join(" · ");
    const certificateLabel = [certificate.lab, certificate.number].filter(Boolean).join(" ");
    const diamondProperties = config.providerMode === "fixture"
      ? {
          "_Veylin Ring Builder": bundleId,
          "_Ring Builder Test Offer": diamond.offerId,
          Diamond: description,
          Certificate: certificateLabel,
        }
      : {
          "_Veylin Ring Builder": bundleId,
          "_Nivoda Offer ID": diamond.offerId,
          "_Nivoda Diamond ID": diamond.diamondId,
          Diamond: description,
          Certificate: certificateLabel,
        };

    return Response.json({
      diamond,
      items: [
        {
          id: Number(selection.settingVariantId),
          quantity: 1,
          properties: {
            "_Veylin Ring Builder": bundleId,
            [supplierOrderCartProperty]: supplierOrderTarget,
            "Ring selection": "Custom ring setting",
          },
        },
        {
          id: Number(mapping.numericVariantId),
          quantity: 1,
          properties: {
            ...diamondProperties,
            [supplierOrderCartProperty]: supplierOrderTarget,
          },
        },
      ],
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Ring builder selection failed", error);
    return Response.json(
      { error: "We could not confirm this ring. Your cart was not changed." },
      { status: 503 },
    );
  }
};
