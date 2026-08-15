# Shopify 2.0 production-readiness record

This is the release gate for Veylin. It complements the per-file decisions in
`block-section-audit.md` and the ownership rules in `theme-architecture.md`.

## Architecture status

- JSON templates compose sections on every supported route. Shopify-controlled
  policy output is wrapped in the layout with a native policy rail and shared
  content typography; policy bodies remain platform-owned.
- Sections own layout/data sources, public blocks own merchant-editable units,
  private underscore blocks own contextual composition, and snippets own shared
  rendering behavior.
- Product page, Featured product, and Quick view use one gallery, product block
  family, variant JSON, CSS, and JavaScript runtime.
- Collection, Search, Recommendations, Cart upsells, and Homepage product rows
  use one composable product-card family.
- Header navigation uses one Shopify menu; footer columns use native menus and
  native policy/payment/localization data.
- Search supports menu overlay, drawer, or page. Cart supports drawer or page.
- Global editorial primitives include Text, Rich text, Button, Group,
  Accordion, Media, Icon, Border, Menu, Email signup, Policy links, Payment
  icons, Spacer, Huge text, and Custom Liquid.

## Required route coverage

The repository includes 404, article, blog, cart, collection, gift card, home,
list collections, page, contact, password, product, search, policy, and customer
account templates. Adding a route is incomplete until its template, section
composition, empty/loading/error states, localization, keyboard behavior, and
responsive QA are covered.

## Automated gates

`bin/veylin-lint.py` checks conventions Shopify's checker does not: legal range
steps/defaults, resolved translations, global setting references, stored block
types, dead destinations, shop-data leakage, LQIP contracts, ES5 delivery,
central icon use, shared block schemas/renderers, and shared CTA markup.
It also rejects missing/orphan snippets and invalid or over-limit JSON
template/section-group composition, and protects the mandatory standalone
Custom Liquid section on every section-capable template.

Every release must also pass:

```text
python bin/veylin-lint.py
shopify theme check --path . --output json
node --check assets/theme.js
node --check assets/main-product.js
git diff --check
```

An empty Theme Check JSON array means the static check passed; it is not proof
of storefront behavior, app compatibility, correct merchant content, remote
upload, or visual quality.

## Manual acceptance gates

1. Product parity: one variant selection updates label, variant id, price,
   availability, SKU/inventory where present, Add to cart, accelerated checkout,
   and full-details URL in all three Product surfaces.
2. Media: carousel and stacked layouts, video-first ordering, large-first tile,
   zoom, model/video controls, variant media, and adaptive sticky behavior.
3. Product cards: fixed and fluid sizing, sparse rows, quick view, option
   controls, badges, sale/unit prices, sold-out state, and add/choose actions.
4. Discovery: predictive search, drawer/menu/page modes, no-results state,
   collection filters/sort/pagination, recommendations, and cart upsells.
5. Commerce: drawer/page cart, quantity/removal errors, cart note, localization,
   pickup, gift cards, dynamic checkout, tax/shipping notes, and checkout handoff.
6. Accessibility: semantic headings/landmarks, labels, focus trap/return, Escape,
   arrow-key behavior where documented, visible focus, reduced motion, color
   contrast, reflow, and screen-reader announcements.
7. Performance: responsive image sizes, lazy loading below the fold, no layout
   shifts from fixed cards or media, deferred scripts, and no obsolete duplicate
   component payload.
8. Theme editor: add/remove/reorder every public block, app blocks, dynamic
   sources, section reloads, and defaults on a fresh theme copy.

## Shopify references

- Theme Store requirements: https://shopify.dev/docs/storefronts/themes/store/requirements
- Sections and blocks best practices: https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks
- JSON template architecture: https://shopify.dev/docs/storefronts/themes/architecture/templates/json-templates
- Theme architecture limits: https://shopify.dev/docs/storefronts/themes/architecture/limits
- Theme blocks: https://shopify.dev/docs/storefronts/themes/architecture/blocks

The official requirements are a minimum. Publication still needs original
design review, merchant-content completion, browser/device QA, and a deliberate
publish decision on an unpublished duplicate theme.
