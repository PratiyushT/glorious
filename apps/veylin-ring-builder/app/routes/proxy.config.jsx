import { authenticate } from "../shopify.server";
import {
  assertAllowedShop,
  isNivodaConfigured,
  ringBuilderConfig,
} from "../lib/config.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return Response.json({ error: "App installation required" }, { status: 401 });
  const config = ringBuilderConfig();
  assertAllowedShop(session.shop, config);

  return Response.json(
    {
      ready: isNivodaConfigured(config),
      orderMode: config.orderMode === "paid" ? "automatic" : "manual",
      cacheSeconds: config.cacheSeconds,
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
};
