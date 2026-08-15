import test from "node:test";
import assert from "node:assert/strict";
import { builderPagePath, ensureBuilderPage } from "./shopify-content.server.js";

function response(data) {
  return { json: async () => ({ data }) };
}

test("the canonical builder path is /build", () => {
  assert.equal(builderPagePath, "/build");
});

test("an existing builder page keeps its merchant title and content", async () => {
  const calls = [];
  const admin = {
    graphql: async (query, options) => {
      calls.push({ query, options });
      if (query.includes("BuilderPages")) {
        return response({
          pages: {
            nodes: [{
              id: "gid://shopify/Page/1",
              handle: "build",
              isPublished: true,
              templateSuffix: "ring-builder",
              title: "My Bespoke Builder",
            }],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        });
      }
      return response({
        urlRedirects: {
          nodes: [{
            id: "gid://shopify/UrlRedirect/1",
            path: "/build",
            target: "/pages/build",
          }],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      });
    },
  };

  const page = await ensureBuilderPage(admin);
  assert.equal(page.title, "My Bespoke Builder");
  assert.equal(page.created, false);
  assert.equal(calls.length, 2);
});

test("a missing builder page is created as a published ring-builder page", async () => {
  const calls = [];
  const admin = {
    graphql: async (query, options) => {
      calls.push({ query, options });
      if (query.includes("BuilderPages")) {
        return response({
          pages: {
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        });
      }
      if (query.includes("CreateBuilderPage")) {
        return response({
          pageCreate: {
            page: {
              id: "gid://shopify/Page/2",
              handle: "build",
              isPublished: true,
              templateSuffix: "ring-builder",
              title: "Build Your Ring",
            },
            userErrors: [],
          },
        });
      }
      if (query.includes("BuilderRedirects")) {
        return response({
          urlRedirects: {
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
          },
        });
      }
      return response({
        urlRedirectCreate: {
          urlRedirect: {
            id: "gid://shopify/UrlRedirect/2",
            path: "/build",
            target: "/pages/build",
          },
          userErrors: [],
        },
      });
    },
  };

  const page = await ensureBuilderPage(admin);
  assert.equal(page.created, true);
  assert.deepEqual(calls[1].options.variables.page, {
    title: "Build Your Ring",
    handle: "build",
    isPublished: true,
    templateSuffix: "ring-builder",
  });
  assert.deepEqual(calls[3].options.variables.urlRedirect, {
    path: "/build",
    target: "/pages/build",
  });
});
