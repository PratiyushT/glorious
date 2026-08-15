import { retailPrice } from "./pricing.js";

const SHAPES = [
  "ROUND",
  "OVAL",
  "PRINCESS",
  "CUSHION",
  "EMERALD",
  "PEAR",
  "RADIANT",
  "MARQUISE",
];
const COLORS = ["D", "E", "F", "G", "H", "I"];
const CLARITIES = ["VVS1", "VVS2", "VS1", "VS2", "SI1", "SI2"];
const CUTS = ["EX", "VG", "G"];

const FIXTURES = Array.from({ length: 24 }, (_, index) => {
  const number = index + 1;
  const diamondId = `FIXTURE-${String(number).padStart(3, "0")}`;
  const carats = Number((0.55 + index * 0.1).toFixed(2));

  return {
    offerId: `DIAMOND/${diamondId}`,
    diamondId,
    source: index % 2 === 0 ? "natural" : "lab",
    costMinor: 56000 + index * 7300,
    certificate: {
      lab: index % 3 === 0 ? "GIA" : "IGI",
      number: `TEST-${String(260000 + number)}`,
      shape: SHAPES[index % SHAPES.length],
      carats,
      color: COLORS[index % COLORS.length],
      clarity: CLARITIES[index % CLARITIES.length],
      cut: CUTS[index % CUTS.length],
      polish: index % 4 === 0 ? "VG" : "EX",
      symmetry: index % 5 === 0 ? "VG" : "EX",
      fluorescence: index % 4 === 0 ? "FAINT" : "NONE",
      width: Number((4.8 + index * 0.08).toFixed(2)),
      length: Number((5.1 + index * 0.1).toFixed(2)),
      depth: Number((3.1 + index * 0.05).toFixed(2)),
      depthPercentage: Number((60.5 + (index % 6) * 0.4).toFixed(1)),
      table: 55 + (index % 5),
    },
  };
});

function publicDiamond(fixture, currency, config) {
  return {
    offerId: fixture.offerId,
    diamondId: fixture.diamondId,
    availability: "AVAILABLE",
    image: null,
    video: null,
    price: retailPrice(fixture.costMinor, config),
    currency,
    discount: 0,
    certificate: fixture.certificate,
  };
}

function includes(values, value) {
  return values.length === 0 || values.includes(value);
}

function matches(fixture, filters, config) {
  const diamond = publicDiamond(fixture, filters.currency, config);
  const price = Number(diamond.price);

  return (
    (filters.source === "both" || fixture.source === filters.source) &&
    includes(filters.shapes, fixture.certificate.shape) &&
    includes(filters.colors, fixture.certificate.color) &&
    includes(filters.clarities, fixture.certificate.clarity) &&
    includes(filters.cuts, fixture.certificate.cut) &&
    fixture.certificate.carats >= filters.minCarat &&
    fixture.certificate.carats <= filters.maxCarat &&
    price >= filters.minPrice &&
    price <= filters.maxPrice
  );
}

function compare(sort) {
  const [field, direction] = sort.split("_");
  const multiplier = direction === "desc" ? -1 : 1;

  return (left, right) => {
    const leftValue = field === "size" ? left.certificate.carats : Number(left.price);
    const rightValue = field === "size" ? right.certificate.carats : Number(right.price);
    return (leftValue - rightValue) * multiplier;
  };
}

export function searchFixtureDiamonds(filters, config) {
  const matchesFilters = FIXTURES
    .filter((fixture) => matches(fixture, filters, config))
    .map((fixture) => publicDiamond(fixture, filters.currency, config))
    .sort(compare(filters.sort));

  return {
    providerMode: "fixture",
    providerEnvironment: "fixture",
    items: matchesFilters.slice(filters.offset, filters.offset + filters.limit),
    total: matchesFilters.length,
    limit: filters.limit,
    offset: filters.offset,
  };
}

export function getFixtureDiamond(diamondId, currency, config) {
  const fixture = FIXTURES.find((item) => item.diamondId === diamondId);
  if (!fixture) throw new Error("This test diamond is no longer available");
  return publicDiamond(fixture, currency, config);
}

export const fixtureDiamondCount = FIXTURES.length;
