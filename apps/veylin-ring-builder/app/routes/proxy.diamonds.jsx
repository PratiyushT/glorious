import { authenticate } from "../shopify.server";
import { assertAllowedShop, ringBuilderConfig } from "../lib/config.server";
import { searchDiamonds } from "../lib/nivoda.server";
import { parseSearchParams } from "../lib/validation";

export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return Response.json({ error: "App installation required" }, { status: 401 });
  const config = ringBuilderConfig();
  assertAllowedShop(session.shop, config);
  const url = new URL(request.url);
  const filters = parseSearchParams(Object.fromEntries(url.searchParams));

  try {
    const result = await searchDiamonds(filters, config);
    return Response.json(result, {
      headers: { "Cache-Control": `private, max-age=${config.cacheSeconds}` },
    });
  } catch (error) {
    console.error("Nivoda search failed", error);
    return Response.json(
      { error: "Live diamonds are temporarily unavailable. Please try again." },
      { status: 503, headers: { "Retry-After": String(config.cacheSeconds) } },
    );
  }
};
