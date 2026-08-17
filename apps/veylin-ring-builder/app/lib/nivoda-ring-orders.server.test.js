import test from "node:test";
import assert from "node:assert/strict";
import {
  RING_ORDER_CONTRACT_VERSION,
  createNivodaRingOrder,
  ringOrderSignature,
} from "./nivoda-ring-orders.server.js";

test("ring adapter signatures are deterministic and versioned", () => {
  assert.equal(RING_ORDER_CONTRACT_VERSION, "2026-08-15");
  assert.equal(
    ringOrderSignature('{"order":1}', "secret"),
    "sha256=0d4d5b71f9134965fc4dc99220061b5e666e9e71106fbbef384c50a33cd0bcfa",
  );
});

test("fixture ring orders complete without a supplier network request", async () => {
  let called = false;
  const request = async () => {
    called = true;
    throw new Error("fixture adapter must not call fetch");
  };

  const result = await createNivodaRingOrder({
    id: "test-1",
    isFixture: true,
  }, {
    providerMode: "fixture",
    ringOrderMode: "fixture",
  }, request);

  assert.equal(result.id, "fixture-ring-test-1");
  assert.equal(result.status, "submitted");
  assert.equal(called, false);
});

test("production ring orders use the signed idempotent adapter contract", async () => {
  let captured;
  const request = async (url, options) => {
    captured = { url, options };
    return new Response(JSON.stringify({
      order: { id: "ring-42", status: "accepted" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const order = {
    id: "local-42",
    isFixture: false,
    idempotencyKey: "veylin-key-42",
    snapshot: {
      shopifyOrderName: "#1042",
      setting: { sku: "SETTING-42" },
      diamond: { offerId: "DIAMOND/42" },
    },
  };
  const config = {
    providerMode: "nivoda",
    providerEnvironment: "production",
    ringOrderMode: "webhook",
    ringOrderUrl: "https://supplier.example/orders/rings",
    ringOrderSecret: "contract-secret-that-is-at-least-32-chars",
    nivodaDestinationId: "destination-42",
  };

  const result = await createNivodaRingOrder(order, config, request);

  assert.equal(captured.url, config.ringOrderUrl);
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Idempotency-Key"], order.idempotencyKey);
  assert.equal(captured.options.headers["X-Veylin-Contract-Version"], RING_ORDER_CONTRACT_VERSION);
  assert.equal(
    captured.options.headers["X-Veylin-Signature"],
    ringOrderSignature(captured.options.body, config.ringOrderSecret),
  );
  assert.deepEqual(JSON.parse(captured.options.body), {
    version: RING_ORDER_CONTRACT_VERSION,
    idempotencyKey: order.idempotencyKey,
    reference: "#1042",
    destinationId: "destination-42",
    bundle: order.snapshot,
  });
  assert.deepEqual(result, {
    id: "ring-42",
    status: "accepted",
    provider: "nivoda_ring_webhook",
  });
});
