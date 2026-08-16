export const DIAMOND_ORDER_TARGET = "diamond_only";
export const RING_ORDER_TARGET = "complete_ring";
export const supplierOrderCartProperty = "_Veylin Supplier Order Target";

export function normalizeSupplierOrderTarget(value) {
  return value === RING_ORDER_TARGET ? RING_ORDER_TARGET : DIAMOND_ORDER_TARGET;
}
