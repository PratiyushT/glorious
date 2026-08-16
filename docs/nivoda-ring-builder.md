# Nivoda ring builder

## Integration contract

The Ring Builder is a third-party app integration, not theme functionality.
Shopify supplies the `/build` page and the `page.ring-builder` JSON template as
an empty app-capable shell. The installed Veylin Ring Builder app supplies the
visible builder, styles, scripts, settings data, diamond search, and selection
validation through its Theme App Extension and app proxy.

Shopify's native page route remains `/pages/build`. The app creates or repairs
that page, assigns the shell template, and maintains the `/build` redirect. It
preserves any merchant-written page title or body. Removing the app block, or
uninstalling the app, removes the integration without leaving theme-owned Ring
Builder code behind.

The app owns its cards and Quick Views but follows the storefront's shared
product presentation contract, including loaders, media transitions, option
pills, prices, buttons, and selected states. Builder cards never navigate to a
product page. Merchants can enable or disable each relevant product-card and
Quick View capability from the app block settings; all selection actions remain
inside the builder.

## Shopify cart and checkout

The completed ring is added through Shopify's Ajax Cart API as two linked line
items:

1. the selected Shopify ring-setting variant;
2. a short-lived Shopify diamond variant whose price was revalidated
   immediately before add-to-cart.

Both items share a private bundle identifier. The app then refreshes and opens
the theme's existing cart drawer. Shopify remains the authority for inventory,
discounts, tax, shipping, currency presentation, checkout, payment, order
creation, and customer notifications.

## Merchant setup

1. Open **Veylin Ring Builder** in Shopify admin and confirm `/build` is ready.
2. Select the Shopify collection containing the ring-setting products and save.
3. Use **Add the Ring Builder app integration to the /build shell**.
4. Save the app block in the theme editor.
5. Add `/build` to the desired Shopify navigation menu.

Ring settings are ordinary Shopify products and variants. Keep unavailable
settings unpublished or out of stock; the app rechecks the selected variant
before accepting the final ring.

### Pause or deactivate the builder

Remove or hide the Ring Builder app block to stop the storefront integration.
For a complete storefront removal, also remove `/build` from navigation and
unpublish the Shopify page. Existing Shopify orders and cart lines are not
altered.

## App configuration

Use the values documented in `apps/veylin-ring-builder/.env.example`.

- `NIVODA_API_URL`, `NIVODA_USERNAME`, and `NIVODA_PASSWORD` are server-only.
- `RING_BUILDER_ALLOWED_SHOP` restricts the app to this store.
- `RING_BUILDER_RETAIL_MARKUP_PERCENT` may be zero or a positive percentage.
- `RING_BUILDER_CACHE_SECONDS` is never allowed below 30 seconds.
- `RING_BUILDER_SEARCH_PRICE_MODE=retail` displays Nivoda's search retail
  price; selection is always revalidated from the live detail response.
- `NIVODA_ORDER_MODE=disabled` is the safe default.
- `RING_BUILDER_PROVIDER_MODE=nivoda` is the live integration. Set it to
  `fixture` only on a development or staging app to expose 24 deterministic
  test diamonds without Nivoda credentials.

When the provider mode is omitted during local development and no Nivoda
credentials exist, the app also falls back to fixture mode automatically.
Production never uses that implicit fallback.

The app requires product, publication, app-proxy, content, and online-store
navigation scopes. Content write access maintains the Shopify page; navigation
write access maintains only the `/build` redirect. Nivoda credentials never
enter Liquid, JavaScript, cart properties, or metafields.

## Proof before Nivoda access

Fixture mode exercises the app UI and Shopify side of the contract: setting
selection, 24-diamond search, filters, pagination, detail revalidation,
temporary product creation, linked native cart submission, and the normal
Shopify checkout handoff. Test products are prefixed `[TEST]`, use the
`Veylin Test` vendor, and paid-order supplier submission is forced off.

Fixture mode is intentionally not presented as live Nivoda evidence. It cannot
prove Nivoda authentication, live inventory, supplier images or videos,
current supplier pricing, or supplier-order submission. Those require Nivoda
staging or production access and separate verification.

### Official Nivoda staging

Nivoda's official API setup guide currently publishes a shared staging test
user. It can be used without a personal Nivoda account to test the real staging
search, detail-price revalidation, and Nivoda-provided supplier media. Read the
credentials from the current official guide, provide them only to the local app
host, set `RING_BUILDER_PROVIDER_MODE=nivoda`, and keep
`NIVODA_ORDER_MODE=disabled`. Do not commit the shared credentials; Nivoda can
rotate or withdraw them.

- Staging access: <https://buyerhelp.nivoda.com/hc/en-gb/articles/32580209466897-How-do-I-access-the-staging-environment-for-API>
- API setup guide: <https://engineering.nivoda.net/hubfs/Nivoda%20API%20Installation%20Guide%20-%20Help%20Centre.pdf>

## Production gate

Do not enable automatic supplier ordering until all of these are true:

- Nivoda has issued production credentials and completed its required domain
  or IP approval;
- a permanent HTTPS host and persistent production database are deployed;
- the production destination ID is verified;
- Shopify has approved protected order data for the app;
- the paid-order webhook is present in the deployed app configuration;
- a complete test order has been reconciled against Nivoda without duplicate
  submission.

Until then, keep supplier ordering disabled. Shopify cart and checkout remain
Shopify-managed, but fulfilment must not be represented as Nivoda-connected.

## Failure behavior and rollback

- Provider or network failures leave the cart unchanged and provide a retry
  state. HTML host or proxy errors are not exposed as raw JSON messages.
- A price or availability change is shown before Shopify cart submission.
- A partially created temporary product is recovered by its deterministic app
  handle on retry instead of creating a duplicate.
- If the app is unavailable, the normal store, cart, and checkout remain usable;
  only `/build` cannot validate a diamond.
- To roll back, remove the app block. For full removal, remove `/build` from
  navigation and unpublish the page.
