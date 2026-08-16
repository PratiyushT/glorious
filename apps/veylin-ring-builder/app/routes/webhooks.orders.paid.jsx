import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createNivodaOrder } from "../lib/nivoda.server";
import { ringBuilderConfig } from "../lib/config.server";
import {
  paidOrderBundles,
  supplierSubmissionDecision,
} from "../lib/supplier-orders.server";

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);
  const config = ringBuilderConfig();
  const shopifyOrderId = String(payload.admin_graphql_api_id || payload.id);
  const bundles = paidOrderBundles(payload);

  for (const bundle of bundles) {
    const { offerId } = bundle;
    const mapping = await prisma.diamondVariant.findUnique({
      where: { shop_offerId: { shop, offerId } },
    });
    if (!mapping || !mapping.variantId.endsWith(`/${bundle.snapshot.diamond.variantId}`)) {
      continue;
    }

    const existing = await prisma.nivodaOrder.findUnique({
      where: { shop_shopifyOrderId_offerId: { shop, shopifyOrderId, offerId } },
    });
    if (existing) continue;

    const decision = supplierSubmissionDecision(bundle, config);
    const record = await prisma.nivodaOrder.create({
      data: {
        shop,
        shopifyOrderId,
        offerId,
        orderTarget: bundle.orderTarget,
        bundleId: bundle.bundleId || null,
        settingProductId: bundle.settingProductId,
        settingVariantId: bundle.settingVariantId,
        snapshot: JSON.stringify(bundle.snapshot),
        reviewReason: decision.reason,
        status: decision.automatic ? "submitting" : "manual_review",
        attempts: decision.automatic ? 1 : 0,
      },
    });
    if (!decision.automatic) continue;

    try {
      const result = await createNivodaOrder({
        offerId,
        reference: `Shopify ${payload.name || payload.order_number || payload.id}`,
      }, config);
      await prisma.nivodaOrder.update({
        where: { id: record.id },
        data: {
          status: result?.status || "submitted",
          nivodaOrderId: result?.id ? String(result.id) : null,
        },
      });
    } catch (error) {
      console.error("Nivoda paid-order submission needs review", error);
      await prisma.nivodaOrder.update({
        where: { id: record.id },
        data: {
          status: "action_required",
          error: String(error.message).slice(0, 1000),
        },
      });
    }
  }

  return new Response();
};
