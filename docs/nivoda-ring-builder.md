# Nivoda ring builder

## Storefront contract

The customer-facing builder lives at `/build` and uses the
`page.ring-builder` JSON template. Shopify's native page route remains
`/pages/build`; the app maintains a Shopify URL redirect from `/build`, and the
theme keeps the public address bar on `/build` after Shopify resolves the
request. The app repairs the page, template assignment, and route when it is
opened in admin. It preserves any title or body content already written for
the page.

The theme renders every visible part of the builder. It uses the current theme
color scheme, typography, buttons, loaders, page width, spacing, image
presentation, and cart drawer. The app proxy supplies server-validated Nivoda
data; it does not render a second storefront.

## Shopify cart and checkout

The completed ring is added through Shopify's Ajax Cart API as two linked line
items:

1. the selected Shopify ring-setting variant;
2. a hidden, short-lived Shopify diamond variant whose price was revalidated
   against the selected Nivoda offer immediately before add-to-cart.

Both items share a private bundle identifier. The theme submits them together,
then refreshes and opens the existing Veylin cart drawer. Shopify remains the
authority for inventory, discounts, tax, shipping, currency presentation,
checkout, payment, order creation, and customer notifications.

## Merchant setup

1. Open **Veylin Ring Builder** in Shopify admin once and confirm that the
   `/build` status is ready.
2. Open the **Build Your Ring** page in the theme editor.
3. Select the collection containing products that can be used as settings.
4. Configure setting-card media, columns, diamond defaults, step order,
   summary behavior, color scheme, and shared button styles in the Ring
   builder section.
5. Add `/build` to the desired Shopify navigation menu.

Ring settings are ordinary Shopify products and variants. Keep unavailable
settings unpublished or out of stock; the app rechecks the selected variant
before accepting the final ring.

## App configuration

Use the values documented in `apps/veylin-ring-builder/.env.example`.

- `NIVODA_API_URL`, `NIVODA_USERNAME`, and `NIVODA_PASSWORD` are server-only.
- `RING_BUILDER_ALLOWED_SHOP` restricts the app to this store.
- `RING_BUILDER_RETAIL_MARKUP_PERCENT` may be zero or a positive percentage.
- `RING_BUILDER_CACHE_SECONDS` is never allowed below 30 seconds.
- `RING_BUILDER_SEARCH_PRICE_MODE=retail` displays Nivoda's search retail
  price; selection is always revalidated from the live detail response.
- `NIVODA_ORDER_MODE=disabled` is the safe default.

The app requires product, publication, app-proxy, content, and online-store
navigation scopes. Content write access maintains the Shopify page; navigation
write access maintains only the `/build` redirect. Nivoda credentials never
enter Liquid, JavaScript, cart properties, or metafields.

## Production gate

Do not enable automatic supplier ordering until all of these are true:

- Nivoda has issued production credentials and completed its required domain
  or IP approval;
- a permanent HTTPS host and persistent production database are deployed;
- the production destination ID is verified;
- Shopify has approved protected order data for the app;
- the paid-order webhook has been restored to the deployed app configuration;
- a complete test order has been reconciled against Nivoda without duplicate
  submission.

Until then, live search, selection, Shopify cart, and Shopify checkout can be
tested while supplier ordering stays disabled and fulfilment is reviewed
manually.

## Failure behavior and rollback

- Nivoda or network failures leave the cart unchanged and provide a themed
  retry state.
- A price or availability change is shown before Shopify cart submission.
- If the theme app is unavailable, the normal store, cart, and checkout remain
  usable; only `/build` cannot validate a diamond.
- To roll back, remove `/build` from navigation and unpublish the page. Existing
  Shopify orders and cart lines are not altered.
