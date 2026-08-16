# Veylin Ring Builder

Private Shopify app with a Theme App Extension. Shopify owns the `/build` page
and checkout; the installed app owns the complete Ring Builder integration
rendered inside that page shell.

## Responsibilities

- keeps Nivoda credentials and mutations on the server;
- renders the storefront builder through an app block with app-owned CSS and
  JavaScript;
- stores the merchant's ring-setting collection selection in the app;
- searches and revalidates live diamond offers;
- creates short-lived, hidden Shopify diamond products at the confirmed price;
- returns the setting and diamond as one atomic Shopify cart request;
- records the Nivoda offer snapshot needed for fulfilment;
- creates or repairs the published builder page and its Shopify-managed
  `/build` route without replacing an existing page's merchant title or
  content.

Cart, discounts, taxes, shipping, payment, Shop Pay, checkout, and the final
order all remain Shopify-native. The app does not provide a second cart or a
custom checkout.

## Storefront presentation

The app block renders setting and diamond results with the storefront's shared
product-card, loader, button, option-pill, price, motion, and selected-state
contracts. Product details stay inside the app-owned Quick View; builder cards
do not link to product pages. The app block exposes the relevant card and Quick
View capabilities—media, badges, vendor, title, options, price, description,
diamond specifications, media controls, and selection action—as merchant
settings.

## Local setup

1. Copy `.env.example` to `.env` and add the Shopify app values. The example
   starts in fixture mode, so Nivoda credentials are not required.
2. Set `RING_BUILDER_ALLOWED_SHOP` to the single permitted `.myshopify.com`
   domain.
3. Run `npm install`, `npm run setup`, and `shopify app dev`.
4. Open the app once in Shopify admin. This ensures `/build` exists and uses
   the app-capable `page.ring-builder` shell.
5. Choose the ring-setting collection in the app, then use its activation link
   to add the Ring Builder app block to the `/build` shell.

## Pre-Nivoda proof mode

Set `RING_BUILDER_PROVIDER_MODE=fixture` to exercise the storefront before
Nivoda credentials are available. The server returns 24 deterministic test
diamonds through the same proxy routes used by the live integration. Search,
filters, pagination, detail revalidation, temporary Shopify product creation,
and the native Shopify cart handoff can therefore be tested without a Nivoda
account.

Fixture mode always forces `NIVODA_ORDER_MODE=disabled`. Its Shopify products
are prefixed `[TEST]`, use the `Veylin Test` vendor, and omit the private cart
property consumed by the Nivoda paid-order webhook. It does not prove Nivoda
authentication, live inventory, live pricing, media, or supplier ordering.

## Official Nivoda staging proof

Nivoda's official API guide currently publishes a shared staging test user for
integration work. Use the credentials from the current guide only in the local
app host environment, set `RING_BUILDER_PROVIDER_MODE=nivoda`, keep
`NIVODA_ORDER_MODE=disabled`, and do not commit credentials. This exercises the
actual Nivoda staging search, price revalidation, and whatever supplier images
or videos are present on those staging records without requiring a personal
Nivoda account. Shared staging access can be rotated by Nivoda.

Official access guide: <https://buyerhelp.nivoda.com/hc/en-gb/articles/32580209466897-How-do-I-access-the-staging-environment-for-API>

Official API setup guide: <https://engineering.nivoda.net/hubfs/Nivoda%20API%20Installation%20Guide%20-%20Help%20Centre.pdf>

## Production activation

Keep `NIVODA_ORDER_MODE=disabled` until Nivoda has approved production API
access, the production destination ID is verified, and Shopify has granted the
app access to protected order data. Search and Shopify checkout work while
ordering is disabled; paid orders then require manual supplier review.

Production also requires a permanent HTTPS app host. A Shopify CLI development
tunnel is for local testing only.

See [`../../docs/nivoda-ring-builder.md`](../../docs/nivoda-ring-builder.md) for
the complete merchant and deployment guide.
