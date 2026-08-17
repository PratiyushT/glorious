import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import {
  isSupplierOrderWorkerReady,
  ringBuilderConfig,
} from "../lib/config.server";
import { processQueuedSupplierOrders } from "../lib/supplier-order-processing.server";

function authorized(authorization, secret) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export const action = async ({ request }) => {
  const config = ringBuilderConfig();
  const authorization = request.headers.get("Authorization") || "";
  if (!isSupplierOrderWorkerReady(config)
    || !authorized(authorization, config.supplierOrderWorkerSecret)) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const results = await processQueuedSupplierOrders({}, config);
  return Response.json({
    processed: results.length,
    orders: results.map((order) => ({ id: order.id, status: order.status })),
  }, { headers: { "Cache-Control": "no-store" } });
};

export const loader = () => new Response("Method Not Allowed", {
  status: 405,
  headers: { Allow: "POST" },
});
