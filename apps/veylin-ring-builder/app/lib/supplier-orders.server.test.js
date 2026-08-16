import test from "node:test";
import assert from "node:assert/strict";
import {
  paidOrderBundles,
  supplierSubmissionDecision,
} from "./supplier-orders.server.js";
import {
  DIAMOND_ORDER_TARGET,
  RING_ORDER_TARGET,
  normalizeSupplierOrderTarget,
} from "./supplier-order-targets.js";

const payload = {
  id: 42,
  name: "#1042",
  currency: "USD",
  line_items: [
    {
      id: 1,
      product_id: 100,
      variant_id: 101,
      title: "Solitaire Setting",
      variant_title: "14K Gold / Size 6",
      sku: "SETTING-14K-6",
      quantity: 1,
      properties: [
        { name: "_Veylin Ring Builder", value: "bundle-1" },
      ],
    },
    {
      id: 2,
      product_id: 200,
      variant_id: 201,
      title: "1 ct Round Diamond",
      quantity: 1,
      properties: [
        { name: "_Veylin Ring Builder", value: "bundle-1" },
        { name: "_Veylin Supplier Order Target", value: "complete_ring" },
        { name: "_Nivoda Offer ID", value: "DIAMOND/offer-1" },
        { name: "_Nivoda Diamond ID", value: "diamond-1" },
      ],
    },
  ],
};

test("supplier order targets are restricted to the two supported routes", () => {
  assert.equal(normalizeSupplierOrderTarget("complete_ring"), RING_ORDER_TARGET);
  assert.equal(normalizeSupplierOrderTarget("diamond_only"), DIAMOND_ORDER_TARGET);
  assert.equal(normalizeSupplierOrderTarget("unknown"), DIAMOND_ORDER_TARGET);
});

test("paid orders preserve one complete setting and diamond bundle", () => {
  const [bundle] = paidOrderBundles(payload);

  assert.equal(bundle.orderTarget, RING_ORDER_TARGET);
  assert.equal(bundle.offerId, "DIAMOND/offer-1");
  assert.equal(bundle.settingProductId, "100");
  assert.equal(bundle.settingVariantId, "101");
  assert.equal(bundle.snapshot.setting.sku, "SETTING-14K-6");
  assert.equal(bundle.snapshot.diamond.diamondId, "diamond-1");
});

test("complete-ring targets never call the loose-diamond order mutation", () => {
  const [bundle] = paidOrderBundles(payload);
  const decision = supplierSubmissionDecision(bundle, {
    providerMode: "nivoda",
    providerEnvironment: "production",
    orderMode: "paid",
    nivodaDestinationId: "destination-1",
    nivodaUsername: "user",
    nivodaPassword: "password",
  });

  assert.equal(decision.automatic, false);
  assert.match(decision.reason, /loose-diamond API was not called/);
});

test("diamond-only ordering requires every production safety gate", () => {
  const bundle = { orderTarget: DIAMOND_ORDER_TARGET };
  const ready = {
    providerMode: "nivoda",
    providerEnvironment: "production",
    orderMode: "paid",
    nivodaDestinationId: "destination-1",
    nivodaUsername: "user",
    nivodaPassword: "password",
  };

  assert.equal(supplierSubmissionDecision(bundle, ready).automatic, true);
  assert.equal(supplierSubmissionDecision(bundle, {
    ...ready,
    providerEnvironment: "staging",
  }).automatic, false);
});
