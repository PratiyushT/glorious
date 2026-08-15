import crypto from "node:crypto";
import prisma from "../db.server.js";
import { ringBuilderConfig, isNivodaConfigured } from "./config.server.js";
import { retailPrice } from "./pricing.js";

const AUTH_QUERY = `#graphql
  query NivodaAuthenticate($username: String!, $password: String!) {
    authenticate {
      username_and_password(username: $username, password: $password) {
        token
      }
    }
  }
`;

const DETAIL_QUERY = `#graphql
  query NivodaDiamond($token: String!, $diamondId: ID!) {
    as(token: $token) {
      get_diamond_by_id(diamond_id: $diamondId) {
        id
        price
        discount
        diamond {
          id
          video
          image
          availability
          supplierStockId
          eyeClean
          certificate {
            lab
            shape
            certNumber
            cut
            carats
            clarity
            polish
            symmetry
            color
            width
            length
            depth
            floInt
            depthPercentage
            table
          }
        }
      }
    }
  }
`;

let tokenState = { token: "", expiresAt: 0 };
const pending = new Map();

function graphqlValueList(values, quoted = false) {
  return `[${values.map((value) => (quoted ? JSON.stringify(value) : value)).join(",")}]`;
}

function buildSearchQuery(filters) {
  const clauses = [
    "availability: AVAILABLE",
    "hide_memo: true",
    "treated: false",
    `sizes: { from: ${filters.minCarat}, to: ${filters.maxCarat} }`,
    `dollar_value: { from: ${Math.round(filters.minPrice * 100)}, to: ${Math.round(filters.maxPrice * 100)} }`,
    `preferred_currency: ${filters.currency}`,
    "search_on_preferred_currency: true",
    "search_on_markup_price: false",
    "add_taxes_on_search: false",
  ];

  if (filters.source === "natural") clauses.push("labgrown: false");
  if (filters.source === "lab") clauses.push("labgrown: true");
  if (filters.shapes.length) clauses.push(`shapes: ${graphqlValueList(filters.shapes, true)}`);
  if (filters.colors.length) clauses.push(`color: ${graphqlValueList(filters.colors)}`);
  if (filters.clarities.length) clauses.push(`clarity: ${graphqlValueList(filters.clarities)}`);
  if (filters.cuts.length) clauses.push(`cut: ${graphqlValueList(filters.cuts)}`);

  const [sortType, sortDirection] = filters.sort.split("_");
  return `#graphql
    query NivodaDiamonds($token: String!) {
      as(token: $token) {
        diamonds_by_query(
          query: { ${clauses.join(", ")} }
          offset: ${filters.offset}
          limit: ${filters.limit}
          order: { type: ${sortType}, direction: ${sortDirection.toUpperCase()} }
        ) {
          items {
            id
            diamond {
              id
              video
              image
              availability
              supplierStockId
              eyeClean
              certificate {
                lab
                shape
                certNumber
                cut
                carats
                clarity
                polish
                symmetry
                color
                width
                length
                depth
                floInt
                depthPercentage
                table
              }
            }
            price
            discount
          }
          total_count
        }
      }
    }
  `;
}

function safeMediaUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeItem(item, filters, config, priceMode = "cost") {
  const diamond = item?.diamond || {};
  const certificate = diamond.certificate || {};
  const price = priceMode === "retail"
    ? (Number(item?.price) / config.priceDivisor).toFixed(2)
    : retailPrice(item?.price, config);

  return {
    offerId: item.id,
    diamondId: diamond.id,
    availability: diamond.availability,
    image: safeMediaUrl(diamond.image),
    video: safeMediaUrl(diamond.video),
    price,
    currency: filters.currency,
    discount: item.discount,
    certificate: {
      lab: certificate.lab,
      number: certificate.certNumber,
      shape: certificate.shape,
      carats: certificate.carats,
      color: certificate.color,
      clarity: certificate.clarity,
      cut: certificate.cut,
      polish: certificate.polish,
      symmetry: certificate.symmetry,
      fluorescence: certificate.floInt,
      width: certificate.width,
      length: certificate.length,
      depth: certificate.depth,
      depthPercentage: certificate.depthPercentage,
      table: certificate.table,
    },
  };
}

async function nivodaRequest(query, variables, config) {
  const response = await fetch(config.nivodaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.errors?.length) {
    const message = payload?.errors?.[0]?.message || `Nivoda request failed (${response.status})`;
    throw new Error(message);
  }
  return payload.data;
}

async function token(config, force = false) {
  if (!isNivodaConfigured(config)) throw new Error("Nivoda is not configured");
  if (!force && tokenState.token && tokenState.expiresAt > Date.now()) return tokenState.token;

  const data = await nivodaRequest(
    AUTH_QUERY,
    { username: config.nivodaUsername, password: config.nivodaPassword },
    config,
  );
  const next = data?.authenticate?.username_and_password?.token;
  if (!next) throw new Error("Nivoda authentication returned no token");
  tokenState = { token: next, expiresAt: Date.now() + 350 * 60 * 1000 };
  return next;
}

async function authorizedRequest(query, variables, config) {
  try {
    return await nivodaRequest(query, { ...variables, token: await token(config) }, config);
  } catch (error) {
    if (!/401|auth|token|expired/i.test(error.message)) throw error;
    tokenState = { token: "", expiresAt: 0 };
    return nivodaRequest(query, { ...variables, token: await token(config, true) }, config);
  }
}

async function cached(key, seconds, loader) {
  const existing = await prisma.nivodaCache.findUnique({ where: { key } });
  if (existing && existing.expiresAt > new Date()) return JSON.parse(existing.value);
  if (pending.has(key)) return pending.get(key);

  const request = loader()
    .then(async (value) => {
      await prisma.nivodaCache.upsert({
        where: { key },
        create: {
          key,
          value: JSON.stringify(value),
          expiresAt: new Date(Date.now() + seconds * 1000),
        },
        update: {
          value: JSON.stringify(value),
          expiresAt: new Date(Date.now() + seconds * 1000),
        },
      });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export async function searchDiamonds(filters, config = ringBuilderConfig()) {
  const hash = crypto.createHash("sha256").update(JSON.stringify({
    filters,
    markupPercent: config.markupPercent,
    priceDivisor: config.priceDivisor,
    searchPriceMode: config.searchPriceMode,
  })).digest("hex");
  return cached(`search:${hash}`, config.cacheSeconds, async () => {
    const data = await authorizedRequest(buildSearchQuery(filters), {}, config);
    const result = data?.as?.diamonds_by_query;
    if (!result) throw new Error("Nivoda returned no diamond results");
    return {
      items: result.items.map((item) =>
        normalizeItem(item, filters, config, config.searchPriceMode),
      ),
      total: result.total_count,
      limit: filters.limit,
      offset: filters.offset,
    };
  });
}

export async function getDiamond(diamondId, currency, config = ringBuilderConfig()) {
  const filters = { currency };
  return cached(`diamond:${diamondId}:${currency}`, config.cacheSeconds, async () => {
    const data = await authorizedRequest(DETAIL_QUERY, { diamondId }, config);
    const item = data?.as?.get_diamond_by_id;
    if (!item) throw new Error("This diamond is no longer available");
    return normalizeItem(item, filters, config);
  });
}

export async function createNivodaOrder({ offerId, reference }, config = ringBuilderConfig()) {
  if (config.orderMode !== "paid") throw new Error("Automatic Nivoda ordering is disabled");
  if (!config.nivodaDestinationId) throw new Error("Nivoda destination is not configured");
  const productId = offerId.replace(/^DIAMOND\//, "");
  const mutation = `#graphql
    mutation NivodaCreateOrder($token: String!, $productId: String!, $reference: String!, $destinationId: String!) {
      as(token: $token) {
        create_order(
          ProductType: "DIAMOND"
          ProductId: $productId
          order_reference: $reference
          return: false
          destination_id: $destinationId
        ) { id status }
      }
    }
  `;
  const data = await authorizedRequest(
    mutation,
    { productId, reference, destinationId: config.nivodaDestinationId },
    config,
  );
  return data?.as?.create_order;
}
