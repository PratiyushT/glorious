import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ringBuilderConfig } from "../lib/config.server";
import {
  paidOrderBundles,
  supplierOrderIdempotencyKey,
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

    const decision = supplierSubmissionDecision(bundle, config);
    await prisma.nivodaOrder.upsert({
      where: { shop_shopifyOrderId_offerId: { shop, shopifyOrderId, offerId } },
      create: {
        shop,
        shopifyOrderId,
        offerId,
        orderTarget: bundle.orderTarget,
        orderPolicy: bundle.orderPolicy,
        bundleId: bundle.bundleId || null,
        settingProductId: bundle.settingProductId,
        settingVariantId: bundle.settingVariantId,
        snapshot: JSON.stringify(bundle.snapshot),
        reviewReason: decision.reason,
        status: decision.status,
        idempotencyKey: supplierOrderIdempotencyKey({
          shop,
          shopifyOrderId,
          offerId,
          orderTarget: bundle.orderTarget,
        }),
      },
      update: {
        orderTarget: bundle.orderTarget,
        orderPolicy: bundle.orderPolicy,
        bundleId: bundle.bundleId || null,
        settingProductId: bundle.settingProductId,
        settingVariantId: bundle.settingVariantId,
        snapshot: JSON.stringify(bundle.snapshot),
        idempotencyKey: supplierOrderIdempotencyKey({
          shop,
          shopifyOrderId,
          offerId,
          orderTarget: bundle.orderTarget,
        }),
      },
    });
  }

  return new Response();
};
