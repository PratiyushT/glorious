const DEFAULT_NIVODA_URL =
  "https://intg-customer-staging.nivodaapi.net/api/diamonds";

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function ringBuilderConfig() {
  return {
    nivodaUrl: process.env.NIVODA_API_URL || DEFAULT_NIVODA_URL,
    nivodaUsername: process.env.NIVODA_USERNAME || "",
    nivodaPassword: process.env.NIVODA_PASSWORD || "",
    nivodaDestinationId: process.env.NIVODA_DESTINATION_ID || "",
    orderMode: process.env.NIVODA_ORDER_MODE || "disabled",
    cacheSeconds: Math.max(
      30,
      positiveNumber(process.env.RING_BUILDER_CACHE_SECONDS, 30),
    ),
    variantTtlMinutes: positiveNumber(
      process.env.RING_BUILDER_VARIANT_TTL_MINUTES,
      15,
    ),
    markupPercent: nonNegativeNumber(
      process.env.RING_BUILDER_RETAIL_MARKUP_PERCENT,
      25,
    ),
    priceDivisor: positiveNumber(
      process.env.RING_BUILDER_PRICE_DIVISOR,
      100,
    ),
    searchPriceMode:
      process.env.RING_BUILDER_SEARCH_PRICE_MODE === "cost" ? "cost" : "retail",
    allowedShop: (process.env.RING_BUILDER_ALLOWED_SHOP || "").toLowerCase(),
  };
}

export function isNivodaConfigured(config = ringBuilderConfig()) {
  return Boolean(config.nivodaUsername && config.nivodaPassword);
}

export function assertAllowedShop(shop, config = ringBuilderConfig()) {
  if (config.allowedShop && config.allowedShop !== String(shop).toLowerCase()) {
    throw new Response("Ring builder is not enabled for this shop", {
      status: 403,
    });
  }
}
