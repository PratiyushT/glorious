export const SHAPES = [
  "ROUND",
  "OVAL",
  "PRINCESS",
  "CUSHION",
  "EMERALD",
  "PEAR",
  "HEART",
  "MARQUISE",
  "RADIANT",
  "ASSCHER",
];

export const COLORS = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
export const CLARITIES = [
  "FL",
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "SI3",
  "I1",
  "I2",
  "I3",
];
export const CUTS = ["ID", "EIGHTX", "EX", "VG", "G", "F", "P"];
export const CURRENCIES = [
  "USD",
  "GBP",
  "EUR",
  "AUD",
  "CAD",
  "AED",
  "HKD",
  "INR",
  "ZAR",
  "CHF",
];
export const SORTS = ["price_asc", "price_desc", "size_asc", "size_desc"];

function finite(value, fallback, min, max) {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function allowedList(value, allowed) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map((item) => String(item).trim().toUpperCase()))]
    .filter((item) => allowed.includes(item));
}

export function parseSearchParams(input) {
  const source = ["both", "natural", "lab"].includes(input.source)
    ? input.source
    : "both";
  const minCarat = finite(input.minCarat, 0.5, 0.001, 30);
  const maxCarat = finite(input.maxCarat, 3, minCarat, 30);
  const minPrice = finite(input.minPrice, 0, 0, 10000000);
  const maxPrice = finite(input.maxPrice, 100000, minPrice, 10000000);
  const sort = SORTS.includes(input.sort) ? input.sort : "price_asc";

  return {
    source,
    shapes: allowedList(input.shapes, SHAPES),
    colors: allowedList(input.colors, COLORS),
    clarities: allowedList(input.clarities, CLARITIES),
    cuts: allowedList(input.cuts, CUTS),
    currency: CURRENCIES.includes(String(input.currency).toUpperCase())
      ? String(input.currency).toUpperCase()
      : "USD",
    minCarat,
    maxCarat,
    minPrice,
    maxPrice,
    limit: Math.round(finite(input.limit, 24, 1, 50)),
    offset: Math.round(finite(input.offset, 0, 0, 50000)),
    sort,
  };
}

export function parseSelection(input) {
  const offerId = String(input.offerId || "").trim();
  const diamondId = String(input.diamondId || "").trim();
  const settingVariantId = String(input.settingVariantId || "").trim();

  if (!/^DIAMOND\/[a-zA-Z0-9-]+$/.test(offerId)) {
    throw new Response("Invalid Nivoda offer", { status: 400 });
  }
  if (!/^[a-zA-Z0-9-]+$/.test(diamondId)) {
    throw new Response("Invalid Nivoda diamond", { status: 400 });
  }
  if (!/^\d+$/.test(settingVariantId)) {
    throw new Response("Invalid ring setting", { status: 400 });
  }

  return { offerId, diamondId, settingVariantId };
}

export function shopifyNumericId(gid) {
  const match = String(gid || "").match(/\/(\d+)$/);
  if (!match) throw new Error("Shopify returned an invalid variant ID");
  return match[1];
}
