# Theme architecture map

This is the ownership map for the storefront. It answers three questions before
new UI is added: which section owns the page layout, which block owns the
merchant-editable unit, and which snippet is the one renderer shared by every
context.

## Composition model

```text
Template (page composition)
└─ Section (layout and data source)
   └─ Block (merchant-editable unit)
      └─ Snippet (shared rendering behavior)
```

A section must not duplicate a block renderer. A contextual block must not
duplicate the base block's rendering behavior. Shopify block schemas cannot
import another block's settings, so the editor definitions are necessarily
repeated; `bin/veylin-lint.py` R14 treats those repetitions as one contract and
fails when they drift.

## Base blocks and contextual extensions

| Base | Contextual extension | What changes | Shared renderer or contract |
| --- | --- | --- | --- |
| `text` | `product_title`, `product_vendor`, `product_price` | Content comes from the closest product or selected variant | `text-block`, complete Text appearance schema |
| `rich-text` | `product_description` | Content comes from the product description | `rich-text-block`, complete Rich text appearance schema |
| `button` | `product_buy_buttons` | The action submits Shopify's product form | `button`, `button-style`, complete Button appearance schema |
| `button` | `product_variant_picker` pills | The action selects one option value and adds selected state | `button`, `button-style`, `choice-style`, complete Button appearance schema |
| `button` | `_product-card-add` | The action adds or opens Choose options | `button`, `button-style`, complete Button appearance schema |
| `button` | `_hotspot-add` | The action adds the hotspot product | `button`, `button-style`, complete Button appearance schema |
| `button` | Newsletter offer and cookie actions | The action submits or records consent | `button`; the offer exposes the complete Button appearance schema |
| `group` | `_product-card-group`, `_collection-card-group`, `_hotspot-actions`, `_hotspot-card`, `_collection-card-header`, `_interactive-media-list-header` | Allowed child types are contextual | `layout-group`, `layout-group-style`, complete Group schema |
| `group` | `accordion` | The Group gains a disclosure heading, open state, and desktop behavior | `layout-group`, complete Group schema; shared footer disclosure motion |
| `media` | `_product-media-gallery` | Media comes from the closest product and gains gallery navigation | `product-gallery`, `product-media` |
| `huge-text` | Header, Hero, Footer section values | Shopify forbids their local blocks beside a static theme block, so only content ownership moves to the section | `huge-text`, one art-directed renderer |
| Product context | `product_badges` | Facts come from inventory, pricing, age, or a connected metafield | One badge block and one global Product badges style group |
| Product context | `product_quantity` | Value is submitted to the product form | `input-style` |
| Navigation | `menu` | Links come from a Shopify menu | Native nested menu renderer |
| Store policies | `policy-links` | Policies come from Shopify settings | Native `shop.policies` data |
| Payments | `payment-icons` | Methods come from enabled checkout providers | Native `payment_type_svg_tag` |
| Campaign signup | `email-signup` | Action subscribes a customer | Native Shopify customer form |
| Layout | `spacer`, `border` | Responsive whitespace or a divider | Shared layout tokens |

The remaining contextual product blocks own behavior that has no honest global
editorial base: `product_breadcrumbs`, `product_pickup`, `product_sku`,
`product_inventory`, and `product_custom_liquid`. `product_collapsible` remains
renderable only for saved-template compatibility; new collapsible composition
uses global Accordion. `product_text` is the compatibility name for
merchant-authored product copy and now follows the complete Rich text contract.

## Page map

| Storefront page | Template and sections | Primary blocks | Shared renderers/components |
| --- | --- | --- | --- |
| Home | `index.json`: Hero, Featured products, Lookbook, Collection list, Groups, Testimonials | Global Text/Rich text/Button/Media/Group plus static `_product-card`, `_hotspot`, `_collection-card`, `_testimonial` | Product card family, `button`, typography renderers, `row-carousel`, responsive media |
| Product | `product.json`: Main product, Product recommendations | Static `_product-media-gallery`; ordered `product_*` contextual blocks; recommendation `_product-card` | `product-gallery`, `product-media`, `product-variants-json`, base Text/Rich text/Button renderers |
| Featured product anywhere | `featured-product` section | Exactly the Main product block surface plus a product selector | The same gallery, contextual product blocks, variant JSON, CSS, and JavaScript as Main product |
| Quick view | Header-group `quick-view` section | Static `_product-media-gallery`; merchant-ordered `product_*` blocks; shell-owned full-details link | The same gallery, variant JSON, Product blocks, CSS, and JavaScript as Main product |
| Collection | `collection.json`: Collection header, Main collection | Header theme blocks; static `_product-card` with Media, Badges, Text, Option control, Price, Add | Catalog controls/filter/sort/pagination and the shared product card family |
| Search | `search.json`: Search header, Main search | `search-form`; standard and featured static `_product-card` compositions | Search overlay/rows plus the same catalog and card components as Collection |
| Cart | `cart.json`: Main cart | Contextual cart layout with optional theme/app blocks | `line-options`, `tax-note`, shared Button styling; cart drawer uses the same cart facts |
| Standard page | `page.json`: Group | Global Group/Accordion/Text/Rich text/Button/Media/Icon/Border/Custom Liquid | Base block renderers only |
| Contact | `page.contact.json`: Contact form | Global content blocks above Shopify's contact form | Base typography and shared Button styling |
| Blog index | `blog.json`: Group, Main blog | Global heading blocks and `_article-card` results | Responsive image and pagination components |
| Article | `article.json`: Group, Main article | Global heading blocks plus contextual article/comment content | Base typography, responsive media, shared Button styling |
| Collection index | `list-collections.json`: Group, Main list collections | Global heading blocks and `_collection-card` | Collection card family and pagination |
| 404 | `404.json`: Group | Text and Button | Base typography and Button renderers |
| Password | `password.json`: Main password | Static brand heading, global content blocks, Shopify forms | Shared brand and Button styling |
| Customer/account routes | `main-customer` | Contextual login, registration, orders, and addresses | Shared field tokens, Button styling, and pagination |
| Policy routes | Shopify policy output wrapped by `theme.liquid` | Shopify policy content and native policy navigation | Shared content-page typography and responsive legal rail |

## Product card composition

`_product-card` is the single card shell used by Featured products, Collection,
Search, and Product recommendations. Its children are independently removable
and reorderable:

```text
_product-card
├─ _product-card-media
├─ product_badges
├─ text / rich-text / icon / border / button
├─ _product-card-option-values or _product-card-option-control
├─ _product-card-price
├─ _product-card-add
└─ _product-card-group (nested composition)
```

Media and badges share the card's named `media` grid area. This lets badges
overlay the photograph without being trapped inside the Media block. The badge
block controls position and maximum count. Theme settings own the global
policy: exclusion collection, automatic New age, Sale/Sold out toggles,
`badge:` product-tag parsing, typography, shape, and colors. That one policy is
used by product cards, Main product, Featured product, and Quick view.

## Product detail composition

Main product, Featured product, and Quick view are layout shells around the
same contract. Quick view alone adds its full-details link after the shared
component tree:

```text
Product section
├─ _product-media-gallery (static)
└─ ordered details
   ├─ product_breadcrumbs
   ├─ product_badges
   ├─ product_vendor / product_title / product_price
   ├─ product_description
   ├─ product_variant_picker / product_quantity
   ├─ product_buy_buttons / product_pickup
   └─ product_sku / product_inventory / product_collapsible / app blocks
```

The full product template supplies Shopify's current `product`. Featured
product supplies the product chosen in its section setting. No renderer forks
between the two.

## Shared snippet map

| Domain | Canonical snippets |
| --- | --- |
| Typography | `text-block`, `rich-text-block`, `huge-text`, `text-style` |
| Actions | `button`, `button-style` |
| Disclosure composition | `layout-group`, shared `.disclosure__*` CSS and `initDisclosures` behavior |
| Choices and fields | `choice-style`, `input-style`, `option-swatch` |
| Product detail | `product-gallery`, `product-media`, `product-variants-json`, `gift-card-recipient-form`, pickup snippets |
| Product cards | `card-price`, `card-option`, `card-slide`, `unit-price`, `row-carousel` |
| Catalog | `catalog-header`, `catalog-controls`, `catalog-active-filters`, `catalog-filter-drawer`, `catalog-filter-option`, `catalog-sort`, `catalog-pagination` |
| Cart | `cart-drawer-contents`, `line-options`, `tax-note` |
| Overlays | `overlay-head`, `search-overlay`, `quick-view` shell |
| Layout and tokens | `section-style`, `block-spacing`, `layout-group`, `layout-group-style`, `space-step`, `scale-step`, `theme-tokens` |
| Media | `responsive-image`, `video-lqip-frame` |
| Icons and brand | `icon` dispatcher and `icon-*` implementations; `wordmark`, `wordmark-lockup` |

## Extension rules

1. Add editorial UI as a global block.
2. Add data-bound UI as a contextual block that calls the global renderer.
3. Keep sections responsible for layout and data sources, not markup variants.
4. Add product-card features as children of `_product-card`, never as a second
   product-card snippet.
5. Add popup actions through `button`; popup timing, persistence, forms, and
   consent remain section behavior.
6. Add a new R14 family whenever Shopify forces a base settings schema to be
   copied into a specialized block.
7. Render every CTA through `button`. Purpose-built interface controls keep
   their own semantics and classes; they do not opt into `.btn` styling.
8. Use Accordion for merchant-composed disclosure content. Native `details`
   used by sorting, navigation, recovery, pickup, and address workflows remain
   functional controls rather than content blocks.

The exhaustive decision record for every current block and section is in
`docs/block-section-audit.md`.
