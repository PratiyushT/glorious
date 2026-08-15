# Veylin Ring Builder

Private Shopify app for the Veylin theme. It powers the live Nivoda diamond
search and pricing used by the native theme experience at `/build`.

## Responsibilities

- keeps Nivoda credentials and mutations on the server;
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

## Local setup

1. Copy `.env.example` to `.env` and add the app and Nivoda staging values.
2. Set `RING_BUILDER_ALLOWED_SHOP` to the single permitted `.myshopify.com`
   domain.
3. Run `npm install`, `npm run setup`, and `shopify app dev`.
4. Open the app once in Shopify admin. This ensures `/build` exists and uses
   `page.ring-builder`.
5. In the theme editor, open the Build Your Ring page and choose the Shopify
   collection containing the ring-setting products.

## Production activation

Keep `NIVODA_ORDER_MODE=disabled` until Nivoda has approved production API
access, the production destination ID is verified, and Shopify has granted the
app access to protected order data. Search and Shopify checkout work while
ordering is disabled; paid orders then require manual supplier review.

Production also requires a permanent HTTPS app host. A Shopify CLI development
tunnel is for local testing only.

See [`../../docs/nivoda-ring-builder.md`](../../docs/nivoda-ring-builder.md) for
the complete merchant and deployment guide.
