import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettingCollection } from "./setting-collections.server.js";

test("setting collection exposes only available Shopify variants", () => {
  const result = normalizeSettingCollection({
    id: "gid://shopify/Collection/1",
    title: "Rings",
    products: {
      nodes: [{
        id: "gid://shopify/Product/10",
        title: "Solitaire",
        vendor: "Veylin",
        featuredImage: { url: "https://cdn.shopify.com/ring.jpg", altText: "Ring" },
        variants: {
          nodes: [
            {
              id: "gid://shopify/ProductVariant/101",
              title: "14k gold",
              availableForSale: true,
              price: { amount: "1200.00", currencyCode: "USD" },
              image: null,
            },
            {
              id: "gid://shopify/ProductVariant/102",
              title: "Sold out",
              availableForSale: false,
              price: { amount: "1300.00", currencyCode: "USD" },
              image: null,
            },
          ],
        },
      }],
    },
  });

  assert.equal(result.title, "Rings");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].variants.length, 1);
  assert.equal(result.items[0].variants[0].id, "101");
});

test("setting collection omits products with no available variants", () => {
  const result = normalizeSettingCollection({
    id: "gid://shopify/Collection/1",
    title: "Rings",
    products: {
      nodes: [{
        id: "gid://shopify/Product/10",
        title: "Unavailable ring",
        vendor: "Veylin",
        featuredImage: null,
        variants: {
          nodes: [{
            id: "gid://shopify/ProductVariant/101",
            title: "Default Title",
            availableForSale: false,
            price: { amount: "1200.00", currencyCode: "USD" },
            image: null,
          }],
        },
      }],
    },
  });

  assert.deepEqual(result.items, []);
  assert.equal(normalizeSettingCollection(null), null);
});
