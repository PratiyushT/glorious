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
  const nivodaUrl = process.env.NIVODA_API_URL || DEFAULT_NIVODA_URL;
  const nivodaUsername = process.env.NIVODA_USERNAME || "";
  const nivodaPassword = process.env.NIVODA_PASSWORD || "";
  const requestedProviderMode = process.env.RING_BUILDER_PROVIDER_MODE;
  const useDevelopmentFixtures = !requestedProviderMode
    && process.env.NODE_ENV === "development"
    && !(nivodaUsername && nivodaPassword);
  const providerMode = requestedProviderMode === "fixture" || useDevelopmentFixtures
    ? "fixture"
    : "nivoda";
  const providerEnvironment = providerMode === "fixture"
    ? "fixture"
    : /(^|[.-])(intg|staging)([.-]|$)/i.test(new URL(nivodaUrl).hostname)
      ? "staging"
      : "production";
  const requestedOrderMode = process.env.NIVODA_ORDER_MODE || "disabled";

  return {
    providerMode,
    providerEnvironment,
    nivodaUrl,
    nivodaUsername,
    nivodaPassword,
    nivodaDestinationId: process.env.NIVODA_DESTINATION_ID || "",
    orderMode: providerMode === "fixture" ? "disabled" : requestedOrderMode,
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

export function isDiamondProviderReady(config = ringBuilderConfig()) {
  return config.providerMode === "fixture" || isNivodaConfigured(config);
}

export function isAutomaticDiamondOrderingReady(config = ringBuilderConfig()) {
  return Boolean(
    config.providerMode === "nivoda"
    && config.providerEnvironment === "production"
    && config.orderMode === "paid"
    && config.nivodaDestinationId
    && isNivodaConfigured(config),
  );
}

export function assertAllowedShop(shop, config = ringBuilderConfig()) {
  if (config.allowedShop && config.allowedShop !== String(shop).toLowerCase()) {
    throw new Response("Ring builder is not enabled for this shop", {
      status: 403,
    });
  }
}
