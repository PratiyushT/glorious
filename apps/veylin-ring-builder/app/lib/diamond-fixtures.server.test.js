import test from "node:test";
import assert from "node:assert/strict";
import {
  fixtureDiamondCount,
  getFixtureDiamond,
  searchFixtureDiamonds,
} from "./diamond-fixtures.server.js";
import { parseSearchParams } from "./validation.js";

const config = { priceDivisor: 100, markupPercent: 25 };

test("fixture catalog provides one full 24-diamond page", () => {
  const result = searchFixtureDiamonds(parseSearchParams({}), config);

  assert.equal(fixtureDiamondCount, 24);
  assert.equal(result.providerMode, "fixture");
  assert.equal(result.total, 24);
  assert.equal(result.items.length, 24);
  assert.match(result.items[0].offerId, /^DIAMOND\/FIXTURE-/);
});

test("fixture catalog applies storefront filters and sorting", () => {
  const filters = parseSearchParams({
    source: "lab",
    shapes: "OVAL",
    minCarat: "0.5",
    maxCarat: "3",
    sort: "size_desc",
  });
  const result = searchFixtureDiamonds(filters, config);

  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.certificate.shape === "OVAL"));
  assert.ok(
    result.items.every((item, index) =>
      index === 0 || item.certificate.carats <= result.items[index - 1].certificate.carats,
    ),
  );
});

test("fixture detail revalidation returns the selected offer", () => {
  const result = searchFixtureDiamonds(parseSearchParams({ limit: 1 }), config);
  const selected = result.items[0];
  const detail = getFixtureDiamond(selected.diamondId, "USD", config);

  assert.equal(detail.offerId, selected.offerId);
  assert.equal(detail.price, selected.price);
  assert.equal(detail.availability, "AVAILABLE");
  assert.throws(() => getFixtureDiamond("UNKNOWN", "USD", config));
});
