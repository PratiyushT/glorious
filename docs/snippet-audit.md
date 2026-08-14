# Snippet-by-snippet audit

Snippets are renderers and behavior fragments, never merchant-editable content
models. The audit found 167 snippets: 50 shared/domain renderers plus 117 icon
drawing files. Every snippet is referenced and every static `render` target
exists; there are no orphan or missing snippets.

## Foundations

| Snippet | Single responsibility |
| --- | --- |
| `theme-tokens` | Emits global typography, color-scheme, spacing, motion, input, choice, and button tokens. |
| `space-step` | Resolves named spacing steps. |
| `scale-step` | Resolves named fluid scales. |
| `motion-step` | Resolves named timing/easing values. |
| `section-style` | Converts section padding settings to CSS custom properties. |
| `block-spacing` | Converts block padding/gap settings to CSS custom properties. |
| `text-style` | Converts typography-preset settings to CSS declarations. |
| `text-block` | Canonical Text renderer used by editorial/contextual Text blocks. |
| `rich-text-block` | Canonical Rich text renderer used by editorial/contextual blocks. |
| `layout-group` | Canonical Group/Accordion/private-group layout renderer. |
| `layout-group-style` | Shared Group custom-property resolver. |

## Actions, choices, and forms

| Snippet | Single responsibility |
| --- | --- |
| `button` | The only theme Button appearance markup. |
| `button-style` | Global plus local Button-token resolution. |
| `choice-style` | Variant/choice appearance token resolution. |
| `input-style` | Input/quantity appearance token resolution. |
| `option-swatch` | Shopify option-value swatch rendering. |
| `gift-card-recipient-form` | Native gift-card recipient fields and validation. |
| `localization-form` | Country/language selector form. |
| `footer-entry` | Footer link or overlay-action semantics. |

## Product detail

| Snippet | Single responsibility |
| --- | --- |
| `product-gallery` | Shared carousel/stacked Product gallery composition and ordering. |
| `product-media` | One Shopify product-media item, including image/video/model. |
| `product-variants-json` | Server-formatted variant facts consumed by the shared Product runtime. |
| `pickup-availability-contents` | Section-rendered pickup locations/state. |
| `unit-price` | Native unit-price output. |
| `tax-note` | One tax/shipping-policy note contract. |
| `quick-view` | Empty overlay/fetch shell; contains no Product implementation. |

## Product cards and catalog

| Snippet | Single responsibility |
| --- | --- |
| `card-option` | Product-card option values/controls. |
| `card-price` | Compact card/hotspot pricing. |
| `card-slide` | Product-card media slide. |
| `row-carousel` | Shared sparse/wrapping/carousel product-row frame. |
| `catalog-header` | Shared Collection/Search header layout. |
| `catalog-controls` | Shared filter/sort/quick-link toolbar. |
| `catalog-filter-drawer` | Mobile/compact filter drawer. |
| `catalog-sort` | Native sort options. |
| `catalog-pagination` | Catalog pagination links. |
| `search-row` | Predictive-search result row. |

## Cart and overlays

| Snippet | Single responsibility |
| --- | --- |
| `cart-drawer-contents` | Drawer cart lines, totals, errors, empty state, and upsell slot. |
| `line-options` | Cart-line variant/property details. |
| `nav-menu` | Art-directed navigation overlay using the Header's native menu. |
| `search-overlay` | Predictive search menu/drawer shell. |
| `overlay-head` | Shared overlay brand/close header. |
| `loader` | Accessible branded loading indicator. |

## Media, brand, and metadata

| Snippet | Single responsibility |
| --- | --- |
| `responsive-image` | Responsive Shopify image URL, dimensions, crop, loading, and LQIP contract. |
| `video-lqip-frame` | Poster/LQIP wrapper for hosted/external video. |
| `huge-text` | Shared art-directed oversized word treatment. |
| `wordmark` | Letters-only wordmark renderer. |
| `wordmark-lockup` | Mark plus wordmark composition. |
| `wordmark-mark` | Brand mark renderer. |
| `social-meta-tags` | Open Graph and social sharing metadata. |

## Icon library

`icon` is the only dispatcher. The 117 `icon-*` snippets are intentionally
small drawing files so every control/block calls one named library rather than
copying SVG paths. R12 verifies unique IDs for drawings that define SVG IDs;
R13 rejects inline SVG drawings and CSS-generated icon glyphs outside this
library. The inventory check confirms every drawing is reachable through the
dispatcher and none is orphaned.

## Decisions

- `quick-view-contents` was deleted after Product surfaces converged.
- Price, Button, Group, Text, Rich text, Product media, and catalog headers each
  have one canonical renderer enforced by R14/R15/R16.
- Purpose-built controls (close, carousel, filter, quantity, disclosure) keep
  their semantic classes and do not impersonate editorial Buttons.
- A new snippet must be referenced, documented in this file/family, and added
  to the relevant enforcement rule when it becomes a canonical renderer.
