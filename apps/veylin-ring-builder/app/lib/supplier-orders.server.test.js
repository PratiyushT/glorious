import test from "node:test";
import assert from "node:assert/strict";
import {
  paidOrderBundles,
  supplierOrderIdempotencyKey,
  supplierSubmissionDecision,
} from "./supplier-orders.server.js";
import {
  AUTOMATIC_ORDER_POLICY,
  DIAMOND_ORDER_TARGET,
  REVIEW_ORDER_POLICY,
  RING_ORDER_TARGET,
  normalizeSupplierOrderPolicy,
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
        { name: "_Veylin Supplier Order Policy", value: "automatic" },
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

test("supplier order policy defaults to merchant review", () => {
  assert.equal(normalizeSupplierOrderPolicy("automatic"), AUTOMATIC_ORDER_POLICY);
  assert.equal(normalizeSupplierOrderPolicy("unknown"), REVIEW_ORDER_POLICY);
});

test("paid orders preserve one complete setting and diamond bundle", () => {
  const [bundle] = paidOrderBundles(payload);

  assert.equal(bundle.orderTarget, RING_ORDER_TARGET);
  assert.equal(bundle.orderPolicy, AUTOMATIC_ORDER_POLICY);
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

  assert.equal(decision.status, "manual_review");
  assert.match(decision.reason, /loose-diamond API was not called/);
});

test("diamond-only ordering requires every production safety gate", () => {
  const bundle = {
    orderTarget: DIAMOND_ORDER_TARGET,
    orderPolicy: AUTOMATIC_ORDER_POLICY,
  };
  const ready = {
    providerMode: "nivoda",
    providerEnvironment: "production",
    orderMode: "paid",
    nivodaDestinationId: "destination-1",
    nivodaUsername: "user",
    nivodaPassword: "password",
  };

  assert.equal(supplierSubmissionDecision(bundle, ready).status, "queued");
  assert.equal(supplierSubmissionDecision(bundle, {
    ...ready,
    providerEnvironment: "staging",
  }).status, "manual_review");
});

test("supplier order keys are stable and isolate different targets", () => {
  const input = {
    shop: "example.myshopify.com",
    shopifyOrderId: "gid://shopify/Order/1",
    offerId: "DIAMOND/1",
    orderTarget: DIAMOND_ORDER_TARGET,
  };
  const first = supplierOrderIdempotencyKey(input);

  assert.match(first, /^veylin-[a-f0-9]{64}$/);
  assert.equal(first, supplierOrderIdempotencyKey(input));
  assert.notEqual(first, supplierOrderIdempotencyKey({
    ...input,
    orderTarget: RING_ORDER_TARGET,
  }));
});
