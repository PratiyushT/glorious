import { authenticate } from "../shopify.server";
import {
  assertAllowedShop,
  isDiamondProviderReady,
  ringBuilderConfig,
} from "../lib/config.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return Response.json({ error: "App installation required" }, { status: 401 });
  const config = ringBuilderConfig();
  assertAllowedShop(session.shop, config);

  return Response.json(
    {
      ready: isDiamondProviderReady(config),
      providerMode: config.providerMode,
      providerEnvironment: config.providerEnvironment,
      orderMode: config.providerMode === "fixture"
        ? "disabled"
        : config.orderMode === "paid" ? "automatic" : "manual",
      cacheSeconds: config.cacheSeconds,
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
};
