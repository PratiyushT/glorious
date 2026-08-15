import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchParams, parseSelection, shopifyNumericId } from "./validation.js";

test("search filters discard unknown GraphQL values and cap pagination", () => {
  const filters = parseSearchParams({
    shapes: "ROUND,NOT_A_SHAPE",
    colors: "D,INVALID",
    limit: "500",
    offset: "-4",
    source: "lab",
  });

  assert.deepEqual(filters.shapes, ["ROUND"]);
  assert.deepEqual(filters.colors, ["D"]);
  assert.equal(filters.limit, 50);
  assert.equal(filters.offset, 0);
  assert.equal(filters.source, "lab");
});

test("blank search values use useful storefront defaults", () => {
  const filters = parseSearchParams({
    minCarat: "",
    maxCarat: "",
    minPrice: "",
    maxPrice: "",
    limit: "",
  });

  assert.equal(filters.minCarat, 0.5);
  assert.equal(filters.maxCarat, 3);
  assert.equal(filters.minPrice, 0);
  assert.equal(filters.maxPrice, 100000);
  assert.equal(filters.limit, 24);
});

test("selection accepts only Nivoda offers and numeric Shopify variants", () => {
  assert.deepEqual(
    parseSelection({
      offerId: "DIAMOND/abc-123",
      diamondId: "abc-123",
      settingVariantId: "123456",
    }),
    {
      offerId: "DIAMOND/abc-123",
      diamondId: "abc-123",
      settingVariantId: "123456",
    },
  );
  assert.throws(() => parseSelection({
    offerId: "DIAMOND/abc) { mutation",
    diamondId: "abc",
    settingVariantId: "123",
  }));
});

test("Shopify variant IDs are reduced to Ajax cart IDs", () => {
  assert.equal(shopifyNumericId("gid://shopify/ProductVariant/123456"), "123456");
});
