export const DIAMOND_ORDER_TARGET = "diamond_only";
export const RING_ORDER_TARGET = "complete_ring";
export const REVIEW_ORDER_POLICY = "review";
export const AUTOMATIC_ORDER_POLICY = "automatic";
export const supplierOrderCartProperty = "_Veylin Supplier Order Target";
export const supplierOrderPolicyCartProperty = "_Veylin Supplier Order Policy";

export function normalizeSupplierOrderTarget(value) {
  return value === RING_ORDER_TARGET ? RING_ORDER_TARGET : DIAMOND_ORDER_TARGET;
}

export function normalizeSupplierOrderPolicy(value) {
  return value === AUTOMATIC_ORDER_POLICY
    ? AUTOMATIC_ORDER_POLICY
    : REVIEW_ORDER_POLICY;
}
