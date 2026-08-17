import crypto from "node:crypto";
import prisma from "../db.server.js";
import {
  isAutomaticDiamondOrderingReady,
  isRingOrderAdapterReady,
  ringBuilderConfig,
} from "./config.server.js";
import { createNivodaOrder } from "./nivoda.server.js";
import { createNivodaRingOrder } from "./nivoda-ring-orders.server.js";
import {
  RING_ORDER_TARGET,
  REVIEW_ORDER_POLICY,
  normalizeSupplierOrderTarget,
} from "./supplier-order-targets.js";
import { supplierOrderIdempotencyKey } from "./supplier-orders.server.js";

function snapshot(order) {
  try {
    return JSON.parse(order.snapshot || "{}");
  } catch {
    throw new Error("The supplier order snapshot is invalid");
  }
}

function adapterReady(order, config) {
  if (order.isFixture && config.providerMode === "fixture") return true;
  return order.orderTarget === RING_ORDER_TARGET
    ? isRingOrderAdapterReady(config)
    : isAutomaticDiamondOrderingReady(config);
}

async function submit(order, config) {
  const orderSnapshot = snapshot(order);
  if (order.isFixture && config.providerMode === "fixture") {
    if (order.orderTarget === RING_ORDER_TARGET) {
      return createNivodaRingOrder({
        ...order,
        snapshot: orderSnapshot,
      }, config);
    }
    return {
      id: `fixture-diamond-${order.id}`,
      status: "submitted",
      provider: "fixture_diamond_adapter",
    };
  }
  if (order.orderTarget === RING_ORDER_TARGET) {
    return createNivodaRingOrder({
      ...order,
      snapshot: orderSnapshot,
    }, config);
  }
  const result = await createNivodaOrder({
    offerId: order.offerId,
    reference: `Shopify ${orderSnapshot.shopifyOrderName}`,
  }, config);
  return {
    id: result?.id,
    status: result?.status || "submitted",
    provider: "nivoda_diamond_api",
  };
}

export async function queueSupplierOrder({ id, shop }, config = ringBuilderConfig()) {
  const order = await prisma.nivodaOrder.findFirst({ where: { id, shop } });
  if (!order) throw new Error("Supplier order not found");
  if (!["manual_review", "action_required"].includes(order.status)) {
    throw new Error("This supplier order cannot be queued from its current state");
  }
  if (!adapterReady(order, config)) {
    throw new Error(order.orderTarget === RING_ORDER_TARGET
      ? "Configure the production ring-order adapter before approval"
      : "Configure production Nivoda ordering before approval");
  }
  return prisma.nivodaOrder.update({
    where: { id },
    data: {
      status: "queued",
      reviewReason: null,
      error: null,
    },
  });
}

export async function processSupplierOrderById({ id, shop }, config = ringBuilderConfig()) {
  const claimed = await prisma.nivodaOrder.updateMany({
    where: { id, shop, status: "queued" },
    data: {
      status: "submitting",
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      error: null,
    },
  });
  if (claimed.count !== 1) {
    return prisma.nivodaOrder.findFirst({ where: { id, shop } });
  }

  const order = await prisma.nivodaOrder.findUnique({ where: { id } });
  try {
    const result = await submit(order, config);
    if (!result?.id) throw new Error("The supplier adapter returned no order ID");
    return await prisma.nivodaOrder.update({
      where: { id },
      data: {
        status: "submitted",
        provider: result.provider,
        providerOrderId: String(result.id),
        providerStatus: String(result.status || "submitted"),
        submittedAt: new Date(),
        reviewReason: null,
        error: null,
      },
    });
  } catch (error) {
    console.error("Supplier order submission needs review", error);
    return prisma.nivodaOrder.update({
      where: { id },
      data: {
        status: "action_required",
        error: String(error.message).slice(0, 1000),
      },
    });
  }
}

export async function processQueuedSupplierOrders({ limit = 10 } = {}, config = ringBuilderConfig()) {
  const queued = await prisma.nivodaOrder.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(Number(limit) || 10, 25)),
    select: { id: true, shop: true },
  });
  const results = [];
  for (const order of queued) {
    results.push(await processSupplierOrderById(order, config));
  }
  return results;
}

export async function createFixtureSupplierOrder({ shop, orderTarget, settingTitle }) {
  const id = crypto.randomUUID();
  const shopifyOrderId = `fixture:${id}`;
  const offerId = `DIAMOND/FIXTURE-ORDER-${id}`;
  const normalizedTarget = normalizeSupplierOrderTarget(orderTarget);
  const bundleId = crypto.randomUUID();
  const order = {
    shop,
    shopifyOrderId,
    offerId,
    orderTarget: normalizedTarget,
  };
  const orderSnapshot = {
    shopifyOrderName: `[TEST] ${id.slice(0, 8)}`,
    currency: "USD",
    orderTarget: normalizedTarget,
    orderPolicy: REVIEW_ORDER_POLICY,
    bundleId,
    diamond: {
      offerId,
      diamondId: `FIXTURE-${id.slice(0, 8)}`,
      title: "1.00 ct Round F VS1 test diamond",
      quantity: 1,
    },
    setting: {
      title: settingTitle || "Test ring setting",
      variantTitle: "14K Gold / Size 6",
      sku: "FIXTURE-SETTING-14K-6",
      quantity: 1,
    },
  };

  return prisma.nivodaOrder.create({
    data: {
      ...order,
      orderPolicy: REVIEW_ORDER_POLICY,
      bundleId,
      snapshot: JSON.stringify(orderSnapshot),
      status: "manual_review",
      reviewReason: "Fixture workflow test awaiting merchant approval.",
      idempotencyKey: supplierOrderIdempotencyKey(order),
      isFixture: true,
    },
  });
}
