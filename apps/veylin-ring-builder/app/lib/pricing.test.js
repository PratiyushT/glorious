import test from "node:test";
import assert from "node:assert/strict";
import { retailPrice } from "./pricing.js";

test("retail pricing converts minor units and applies markup once", () => {
  assert.equal(
    retailPrice(100000, { priceDivisor: 100, markupPercent: 25 }),
    "1250.00",
  );
});

test("retail pricing rejects missing and invalid supplier prices", () => {
  assert.throws(() => retailPrice(0, { priceDivisor: 100, markupPercent: 25 }));
  assert.throws(() => retailPrice("unknown", { priceDivisor: 100, markupPercent: 25 }));
});
