import crypto from "node:crypto";
import { isRingOrderAdapterReady, ringBuilderConfig } from "./config.server.js";

export const RING_ORDER_CONTRACT_VERSION = "2026-08-15";

export function ringOrderSignature(body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

function responseOrder(payload) {
  const order = payload?.order || payload;
  if (!order?.id) throw new Error("The ring-order adapter returned no order ID");
  return {
    id: String(order.id),
    status: String(order.status || "submitted"),
  };
}

export async function createNivodaRingOrder(
  order,
  config = ringBuilderConfig(),
  request = fetch,
) {
  if (order.isFixture && config.providerMode === "fixture") {
    return {
      id: `fixture-ring-${order.id}`,
      status: "submitted",
      provider: "fixture_ring_adapter",
    };
  }
  if (!isRingOrderAdapterReady(config)) {
    throw new Error("The Nivoda ring-order adapter is not configured for production");
  }

  const payload = {
    version: RING_ORDER_CONTRACT_VERSION,
    idempotencyKey: order.idempotencyKey,
    reference: order.snapshot.shopifyOrderName,
    destinationId: config.nivodaDestinationId || null,
    bundle: order.snapshot,
  };
  const body = JSON.stringify(payload);
  const response = await request(config.ringOrderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": order.idempotencyKey,
      "X-Veylin-Contract-Version": RING_ORDER_CONTRACT_VERSION,
      "X-Veylin-Signature": ringOrderSignature(body, config.ringOrderSecret),
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error || result?.message || `Ring-order adapter failed (${response.status})`;
    throw new Error(String(message));
  }
  return {
    ...responseOrder(result),
    provider: "nivoda_ring_webhook",
  };
}
