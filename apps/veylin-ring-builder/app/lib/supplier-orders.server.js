import crypto from "node:crypto";
import {
  isAutomaticDiamondOrderingReady,
  isRingOrderAdapterReady,
} from "./config.server.js";
import {
  AUTOMATIC_ORDER_POLICY,
  RING_ORDER_TARGET,
  normalizeSupplierOrderPolicy,
  normalizeSupplierOrderTarget,
  supplierOrderPolicyCartProperty,
  supplierOrderCartProperty,
} from "./supplier-order-targets.js";

const BUNDLE_PROPERTY = "_Veylin Ring Builder";
const OFFER_PROPERTY = "_Nivoda Offer ID";
const DIAMOND_PROPERTY = "_Nivoda Diamond ID";

export function lineProperty(line, name) {
  return line.properties?.find((item) => item.name === name)?.value || "";
}

function lineSnapshot(line) {
  if (!line) return null;
  return {
    lineItemId: line.id == null ? null : String(line.id),
    productId: line.product_id == null ? null : String(line.product_id),
    variantId: line.variant_id == null ? null : String(line.variant_id),
    title: line.title || "",
    variantTitle: line.variant_title || "",
    sku: line.sku || "",
    quantity: Number(line.quantity) || 1,
  };
}

export function paidOrderBundles(payload) {
  const lines = payload.line_items || [];
  const settingByBundle = new Map();

  for (const line of lines) {
    const bundleId = lineProperty(line, BUNDLE_PROPERTY);
    if (bundleId && !lineProperty(line, OFFER_PROPERTY)) {
      settingByBundle.set(bundleId, line);
    }
  }

  return lines.flatMap((line) => {
    const offerId = lineProperty(line, OFFER_PROPERTY);
    if (!offerId) return [];

    const bundleId = lineProperty(line, BUNDLE_PROPERTY);
    const setting = settingByBundle.get(bundleId) || null;
    const orderTarget = normalizeSupplierOrderTarget(
      lineProperty(line, supplierOrderCartProperty),
    );
    const orderPolicy = normalizeSupplierOrderPolicy(
      lineProperty(line, supplierOrderPolicyCartProperty),
    );

    return [{
      bundleId,
      offerId,
      diamondId: lineProperty(line, DIAMOND_PROPERTY),
      orderTarget,
      orderPolicy,
      settingProductId: setting?.product_id == null
        ? null
        : String(setting.product_id),
      settingVariantId: setting?.variant_id == null
        ? null
        : String(setting.variant_id),
      snapshot: {
        shopifyOrderName: payload.name || String(payload.order_number || payload.id || ""),
        currency: payload.currency || "",
        orderTarget,
        orderPolicy,
        bundleId,
        diamond: {
          ...lineSnapshot(line),
          offerId,
          diamondId: lineProperty(line, DIAMOND_PROPERTY),
        },
        setting: lineSnapshot(setting),
      },
    }];
  });
}

export function supplierOrderIdempotencyKey({ shop, shopifyOrderId, offerId, orderTarget }) {
  const digest = crypto.createHash("sha256").update([
    shop,
    shopifyOrderId,
    offerId,
    orderTarget,
  ].join("\u0000")).digest("hex");
  return `veylin-${digest}`;
}

export function supplierSubmissionDecision(bundle, config) {
  if (bundle.orderPolicy !== AUTOMATIC_ORDER_POLICY) {
    return {
      status: "manual_review",
      reason: "Merchant review is required before this supplier order can be queued.",
    };
  }
  if (bundle.orderTarget === RING_ORDER_TARGET) {
    if (isRingOrderAdapterReady(config)) {
      return { status: "queued", reason: null };
    }
    return {
      status: "manual_review",
      reason: "The complete-ring adapter is not production-ready; the loose-diamond API was not called.",
    };
  }
  if (!isAutomaticDiamondOrderingReady(config)) {
    return {
      status: "manual_review",
      reason: "Automatic loose-diamond ordering is not production-ready for this app environment.",
    };
  }
  return { status: "queued", reason: null };
}
