import test from "node:test";
import assert from "node:assert/strict";
import { handleFor, onlineStorePublication } from "./shopify-products.server.js";

test("finds the Online Store publication by publication name", () => {
  const publication = onlineStorePublication([
    {
      id: "gid://shopify/Publication/1",
      name: "Online Store",
      catalog: { title: "Channel Catalog 1 for Online Store" },
    },
    {
      id: "gid://shopify/Publication/2",
      name: "Shop",
      catalog: { title: "Channel Catalog 2 for Shop" },
    },
  ]);

  assert.equal(publication.id, "gid://shopify/Publication/1");
});

test("fixture product handles are deterministic and separate from live handles", () => {
  const diamond = { offerId: "fixture-offer-1" };
  const fixtureHandle = handleFor(diamond, { providerMode: "fixture" });
  const liveHandle = handleFor(diamond, { providerMode: "nivoda" });

  assert.match(fixtureHandle, /^veylin-test-diamond-[a-f0-9]{16}$/);
  assert.match(liveHandle, /^veylin-nivoda-[a-f0-9]{16}$/);
  assert.notEqual(fixtureHandle, liveHandle);
});
