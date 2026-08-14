# Veylin merchant setup

This guide covers the store data that the theme intentionally does not invent.
Finish these items before production launch.

## Navigation and storefront chrome

1. Create Shopify navigation menus for the header and footer.
2. In **Header**, select one menu. The same source drives the art-directed
   full-screen menu and the optional classic inline header.
3. In **Theme settings → Search**, choose **Menu**, **Drawer**, or **Page**.
   Menu and Drawer use predictive search; Page sends customers to `/search`.
4. In **Theme settings → Cart**, choose the drawer or page flow and configure
   the cart recommendation source.
5. In **Footer**, choose native menus. Store policies, enabled payment methods,
   localization, contact details, and Follow on Shop come from Shopify.

## Catalog filtering

1. Install Shopify's official **Search & Discovery** app. Without it, Shopify
   normally exposes only Availability and Price to a theme.
2. In **Search & Discovery → Filters**, add the variant options customers need
   to compare, such as Color, Metal, Gold Karat, Size, or Chain Length. Also add
   useful category, product-type, vendor, taxonomy, or metafield filters.
3. Choose Shopify's swatch or image presentation for visual filters. The theme
   renders Shopify's saved color/image content and never guesses colors from a
   translated option label.
4. Check the collection and search drawers after product-option or metafield
   changes. The theme shows native counts, disables zero-result values, keeps
   all values reachable, and carries active filters through sorting and Ajax
   pagination.

## Product badges

- Add a product tag beginning with `badge:` for every custom badge. Example:
  `badge:Limited edition`. The prefix is not shown.
- Theme settings control custom, Sale, Sold out, and automatic New badges.
- Set the New-product age in days. The comparison uses the product publication
  date and requires no product tag.
- To suppress all badges for a class of products, create a collection and set
  it as **Ignore badge collection**. Membership—not a copied handle—controls
  exclusion.
- The same badge policy is used in product cards, product pages, Featured
  product, and Quick view.

## Product components

Main product, Featured product, and Quick view have separate section shells but
use the same Product blocks. Configure their block order independently while
keeping shared appearance settings aligned.

The Product media gallery supports carousel or stacked gallery, optional large
first media, hosted/external video first, and adaptive Gallery/Details sticky
behavior. Adaptive mode measures both columns and pins the larger one.

Variant pills use the global Button geometry and colors. The selected state is
choice-specific. Add to cart and accelerated checkout use the same global
button sizing/radius contract; Shopify decides whether an accelerated provider
is available for the current product and market.

## Recommendations and upsells

- Homepage recommendations use the selected Featured products collection.
- Product recommendations use Shopify's Product Recommendations endpoint.
- Search can show configured featured results in addition to live results.
- Cart page and cart drawer share the Cart upsell block. It is always a
  carousel and intentionally shows only each product's image and linked name;
  choose its collection, count, motion, arrow position, and cart exclusions.
- Product cards default to fixed sizing so sparse rows do not stretch cards or
  media. Disable it only for deliberately editorial layouts.

## Policies and consent

Create store policies in **Shopify admin → Settings → Policies**. The policy
template renders Shopify's current policy body and builds its navigation from
the store's native policy objects. Do not paste legal policy text into theme
code or blocks.

Configure the cookie notice for the store's legal jurisdiction. The theme uses
Shopify's Customer Privacy API when available; legal compliance still requires
merchant review of tracking apps, markets, wording, and consent categories.

## Launch checklist

- Replace placeholder support/documentation metadata in `settings_schema.json`.
- Set favicon, shop contact details, menus, social profiles, and localization.
- Verify policy content with qualified counsel.
- Test every product option combination, sold-out state, gift card recipient
  form, pickup availability, accelerated checkout, taxes, and unit prices.
- Test header/search/cart modes on desktop, tablet, and mobile.
- Test keyboard navigation, visible focus, reduced motion, and 200% zoom.
- Run `python bin/veylin-lint.py`, `shopify theme check --path . --output json`,
  JavaScript syntax checks, and `git diff --check` before every release.
- Preview and approve a duplicate unpublished theme before publishing.
