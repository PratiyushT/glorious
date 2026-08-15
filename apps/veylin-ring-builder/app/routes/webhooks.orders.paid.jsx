import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createNivodaOrder } from "../lib/nivoda.server";
import { ringBuilderConfig } from "../lib/config.server";

function property(line, name) {
  return line.properties?.find((item) => item.name === name)?.value || "";
}

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);
  const config = ringBuilderConfig();
  const shopifyOrderId = String(payload.admin_graphql_api_id || payload.id);
  const diamondLines = (payload.line_items || []).filter((line) =>
    property(line, "_Nivoda Offer ID"),
  );

  for (const line of diamondLines) {
    const offerId = property(line, "_Nivoda Offer ID");
    const mapping = await prisma.diamondVariant.findUnique({
      where: { shop_offerId: { shop, offerId } },
    });
    if (!mapping || !mapping.variantId.endsWith(`/${line.variant_id}`)) continue;

    const existing = await prisma.nivodaOrder.findUnique({
      where: { shop_shopifyOrderId_offerId: { shop, shopifyOrderId, offerId } },
    });
    if (existing) continue;

    const record = await prisma.nivodaOrder.create({
      data: {
        shop,
        shopifyOrderId,
        offerId,
        status: config.orderMode === "paid" ? "submitting" : "manual_review",
        attempts: config.orderMode === "paid" ? 1 : 0,
      },
    });
    if (config.orderMode !== "paid") continue;

    try {
      const result = await createNivodaOrder({
        offerId,
        reference: `Shopify ${payload.name || payload.order_number || payload.id}`,
      });
      await prisma.nivodaOrder.update({
        where: { id: record.id },
        data: {
          status: result?.status || "submitted",
          nivodaOrderId: result?.id ? String(result.id) : null,
        },
      });
    } catch (error) {
      console.error("Nivoda paid-order submission needs review", error);
      await prisma.nivodaOrder.update({
        where: { id: record.id },
        data: {
          status: "action_required",
          error: String(error.message).slice(0, 1000),
        },
      });
    }
  }

  return new Response();
};
