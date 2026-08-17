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
- records the complete setting and diamond snapshot needed for fulfilment;
- records each paid bundle in an idempotent supplier-order queue, then routes it
  to either loose-diamond or complete-ring fulfilment under the merchant's
  saved review policy;
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

Fixture mode always forces real Nivoda ordering off. Its Shopify products are
prefixed `[TEST]` and use the `Veylin Test` vendor. The app's Operations page
can also create a test supplier order, require merchant approval, and submit it
through a no-network fixture adapter. This proves the app's queue, review,
attempt, and completion states; it does not prove Nivoda authentication, live
inventory, live pricing, media, or receipt of a real supplier order.

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

The default `shopify.app.toml` intentionally omits protected order access so
fixture and storefront development work before approval. After Shopify grants
protected order data, deploy `shopify.app.production.toml`, add `read_orders`
to the production host's `SCOPES`, and reauthorize the app. That configuration
registers the `orders/paid` webhook used by supplier-order processing.

The app exposes two supplier fulfilment targets and two policies. **Review
before submission** is the default and requires an explicit merchant approval
in Operations. **Queue automatically after Shopify payment** can be saved only
when the selected production adapter and authenticated worker are configured.

The paid-order webhook never calls a supplier. It validates and records a
durable, idempotent job, then returns to Shopify. Manual approval processes one
job immediately; automatic mode uses `POST /tasks/supplier-orders` with
`Authorization: Bearer $SUPPLIER_ORDER_WORKER_SECRET` from the production
scheduler. The worker and ring-adapter secrets must be independent random
values of at least 32 characters.

The two fulfilment targets are:

- **Loose diamond only — Nivoda Pro API** may use Nivoda's `create_order`
  mutation after payment, but only when the provider, destination, credentials,
  and production environment gates all pass.
- **Complete ring — approved ring-order adapter** preserves the linked Shopify
  setting and diamond as one fulfilment snapshot. It never sends the bundle
  through the loose-diamond mutation. The app can submit it only to an HTTPS
  endpoint contract approved by the supplier and configured with
  `NIVODA_RING_ORDER_MODE=webhook`, `NIVODA_RING_ORDER_URL`, and
  `NIVODA_RING_ORDER_SECRET`.

Nivoda's public Diamonds GraphQL API documents stone ordering, not ring
manufacturing orders. Do not map complete rings to `ProductType: "DIAMOND"`.
Nivoda Connect supports automatic or two-click ring ordering as a separate
Shopify integration. This app does not call or imitate Nivoda Connect, because
Nivoda does not publish a public complete-ring order mutation. Its signed
webhook is an app-side adapter contract that must be approved and implemented
with the supplier before production use.

Official ring-order guide: <https://buyerhelp.nivoda.com/hc/en-gb/articles/37483986639889-How-can-I-order-rings-from-Nivoda-Connect>

### Signed complete-ring adapter contract

The adapter receives a versioned JSON body containing the idempotency key,
Shopify order reference, optional destination ID, and the non-PII linked
setting/diamond snapshot. Requests include `Idempotency-Key`,
`X-Veylin-Contract-Version`, and an `X-Veylin-Signature` HMAC-SHA256 of the
exact request body. The receiver must return an order ID and must treat a
repeated idempotency key as the same supplier order.

A timeout or provider error moves the job to `action_required`; the app does
not automatically replay an ambiguous purchase. Reconcile the idempotency key
with the supplier first, then use **Retry after supplier reconciliation**.

Production also requires a permanent HTTPS app host. A Shopify CLI development
tunnel is for local testing only.

See [`../../docs/nivoda-ring-builder.md`](../../docs/nivoda-ring-builder.md) for
the complete merchant and deployment guide.
