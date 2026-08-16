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
        handle: "solitaire",
        vendor: "Veylin",
        description: "A low-profile setting.",
        featuredImage: { url: "https://cdn.shopify.com/ring.jpg", altText: "Ring" },
        media: {
          nodes: [{
            mediaContentType: "IMAGE",
            alt: "Solitaire profile",
            image: { url: "https://cdn.shopify.com/profile.jpg", width: 900, height: 900 },
          }],
        },
        variants: {
          nodes: [
            {
              id: "gid://shopify/ProductVariant/101",
              title: "14k gold",
              availableForSale: true,
              price: { amount: "1200.00", currencyCode: "USD" },
              compareAtPrice: { amount: "1400.00", currencyCode: "USD" },
              selectedOptions: [{ name: "Metal", value: "14k gold" }],
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
  assert.equal(result.items[0].handle, "solitaire");
  assert.equal(result.items[0].description, "A low-profile setting.");
  assert.equal(result.items[0].media[0].url, "https://cdn.shopify.com/profile.jpg");
  assert.equal(result.items[0].variants[0].compareAtPrice, "1400.00");
  assert.deepEqual(result.items[0].variants[0].selectedOptions, [{ name: "Metal", value: "14k gold" }]);
});

test("setting collection omits products with no available variants", () => {
  const result = normalizeSettingCollection({
    id: "gid://shopify/Collection/1",
    title: "Rings",
    products: {
      nodes: [{
        id: "gid://shopify/Product/10",
        title: "Unavailable ring",
        handle: "unavailable-ring",
        vendor: "Veylin",
        description: "",
        featuredImage: null,
        media: { nodes: [] },
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
