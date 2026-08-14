# Block and section audit

Audited 13 August 2026. This is the per-file decision record for the current
theme, not a catalogue of possible future features. “Shared” means appearance
or runtime behavior is deliberately inherited from a base component. “Owns”
means the component has context-specific behavior that should not be pushed
into a generic block.

## Blocks

### Global composition

| Block | Role | Audit decision |
| --- | --- | --- |
| `text` | Inline merchant text | Base Text schema and `text-block` renderer. |
| `rich-text` | Paragraphs, lists, links, emphasis | Base Rich text schema and `rich-text-block` renderer. |
| `button` | Merchant CTA | Base Button schema; only `button` emits `.btn` markup. |
| `group` | Child-owning layout | Base Group schema and `layout-group` renderer. |
| `accordion` | Foldable child-owning layout | Group extension. Same child layout settings and renderer; adds heading, default-open, desktop-static, divider, shared footer motion, editor auto-open, and accessible inert/ARIA state. |
| `media` | Merchant image/video | Base editorial media; resource-bound media stays private. |
| `interactive-media` | Merchant media with product hotspots | Global composed feature; contextual hotspot children remain private. |
| `icon` | Theme icon library primitive | Correctly independent; central dispatcher remains the only icon entry point. |
| `border` | Structural divider | Correctly independent and content-free. |
| `custom-liquid` | Merchant-authored Liquid | Correctly independent; intentionally unrestricted escape hatch. |
| `huge-text` | Shared wordmark-scale value | Global block and renderer. Password uses the static block; Header, Hero, and Footer use section-owned values with the same renderer because Shopify forbids mixing their local blocks with a static theme block. |
| `search-form` | Search query form | Action-specific global block; owns submit semantics instead of extending a generic content button. |
| `menu` | Shopify navigation | Native menu source with horizontal/vertical and nested-link presentation; replaces repeated link settings. |
| `email-signup` | Shopify customer form | Reusable campaign signup with native success/error behavior. |
| `policy-links` | Shopify policy data | Native policy links plus optional cookie-preference action; no hardcoded legal destinations. |
| `payment-icons` | Shopify checkout data | Enabled payment methods rendered from the store. |
| `spacer` | Layout primitive | Responsive whitespace without blank Text blocks or section-specific margins. |

### Product detail extensions

| Block | Extends / owns | Audit decision |
| --- | --- | --- |
| `product_title` | Text | Product supplies content; complete Text appearance contract and renderer. |
| `product_vendor` | Text | Product supplies content; complete Text appearance contract and renderer. |
| `product_price` | Text | Selected variant supplies content; complete Text appearance contract and renderer. |
| `product_description` | Rich text | Product supplies content; complete Rich text contract and renderer. |
| `product_text` | Rich text compatibility | Saved-template name retained; now shares the complete Rich text contract and renderer. |
| `product_variant_picker` | Button for pills | Owns option selection; pill appearance shares the complete Button contract, dropdown shares choice tokens. |
| `product_buy_buttons` | Button | Owns Shopify product-form submission; complete Button contract and renderer. |
| `product_badges` | Product facts | One block for Sold out, Sale, automatic New, and `badge:` product tags; global exclusion collection and theme-level policy/tokens. |
| `product_quantity` | Product form input | Owns quantity semantics and uses shared input tokens. |
| `cart_upsell` | Cart product source | Composable cart recommendation block shared by drawer/page contexts; delegates each item to the Product card family. |
| `product_breadcrumbs` | Product navigation | Correctly contextual; no global editorial base. |
| `product_pickup` | Shopify pickup state | Correctly contextual; delegates availability rendering. |
| `product_sku` | Selected variant fact | Correctly contextual atomic metadata. |
| `product_inventory` | Selected variant fact | Correctly contextual atomic metadata. |
| `product_custom_liquid` | Product-bound Liquid | Correctly separate from global Custom Liquid because it promises product context. |
| `product_collapsible` | Saved-template compatibility | Preset removed. Existing saved blocks still render; new content uses global Accordion with children. |
| `_product-media-gallery` | Media | Private contextual extension; shared gallery/media renderer used by Main product and Featured product. |

### Product card family

| Block | Role | Audit decision |
| --- | --- | --- |
| `_product-card` | Private composition shell | Single card shell for Featured products, Collection, Search, and Recommendations. |
| `_product-card-media` | Closest-product media | Private contextual Media; badges share its named grid area. |
| `_product-card-group` | Card-safe Group | Complete Group contract and `layout-group`; child allow-list prevents context leakage. |
| `_product-card-price` | Closest-product price | Shared `card-price` renderer; stays a compact commerce atom rather than duplicating the full detail Price editor. |
| `_product-card-add` | Button | Complete Button contract and renderer; owns add/choose-options behavior. |
| `_product-card-option-values` | Static option display | Correctly private and product-bound. |
| `_product-card-option-control` | Interactive option choice | Correctly private and product-bound; delegates option markup. |

### Collection, article, testimonial, and hotspot families

| Block | Role | Audit decision |
| --- | --- | --- |
| `_collection-card` | Private collection shell | One collection-card composition. |
| `_collection-card-media` | Closest-collection media | Correctly private contextual Media. |
| `_collection-card-header` | Collection-safe Group | Complete Group contract and `layout-group`. |
| `_collection-card-group` | Collection-safe Group | Complete Group contract and `layout-group`. |
| `_collection-count-text` | Text | Collection supplies count; complete Text contract and renderer. |
| `_article-card` | Article result shell | Correctly private; owns article resource rendering. |
| `_testimonial` | Testimonial shell | Correctly private composition of global Text/Rich text children. |
| `_hotspot` | Product hotspot shell | Correctly private; owns popover/row interaction. |
| `_hotspot-card` | Hotspot-safe Group | Complete Group contract and `layout-group`. |
| `_hotspot-actions` | Hotspot-safe Group | Complete Group contract and `layout-group`. |
| `_hotspot-count-text` | Text | Parent supplies position/total; complete Text contract and renderer. |
| `_hotspot-price` | Price atom | Shares `card-price` with Product card. |
| `_hotspot-add` | Button | Complete Button contract and renderer; owns hotspot product submission. |
| `_interactive-media-list-header` | Interactive-media-safe Group | Complete Group contract and `layout-group`. |

## Sections

### Global chrome and overlays

| Section | Audit decision |
| --- | --- |
| `announcement-bar` | Global chrome with its own rotating-message behavior; no duplicate base block family. |
| `header` | Global navigation shell. One native Shopify menu feeds both the art-directed overlay and optional classic inline navigation; search mode comes from global Search settings. |
| `footer` | Global footer shell. Native menus, native store policies, enabled payment methods, social/contact data, and localization replace hand-entered link copies. Link-column disclosure shares Accordion motion. |
| `header-group.json` | Header, cart drawer, composed Quick view, newsletter offer, and cookie notice in one global group. |
| `footer-group.json` | Correct section-group composition for Footer, Cookie banner, and Newsletter popup. |
| `cart-drawer` | Overlay shell; cart contents delegate reusable facts and every CTA now renders through Button. |
| `cookie-banner` | Consent behavior stays section-owned; action appearance uses shared Button. |
| `newsletter-popup` | Offer timing/persistence/form stay section-owned; actions expose the complete Button appearance contract. |
| `predictive-search` | Shopify section-render endpoint; intentionally schema-free and delegates search results. |
| `quick-view` | Merchant-composed header-group section; fetched in product context and delegates to the exact Main/Featured Product blocks and gallery. |

### Reusable editorial and campaign sections

| Section | Audit decision |
| --- | --- |
| `group` | Canonical layout section; captures children and calls `layout-group`. |
| `rich-text` | Editorial section accepting global children, now including Accordion. |
| `hero` | Art-directed campaign layout; local slide/metal/CTA behavior is intentional. Its section value calls the shared Huge Text renderer. |
| `featured-products` | Product source plus standard Product card composition. Settings parity with Recommendations is enforced. |
| `collection-list` | Collection source plus standard Collection card composition; Accordion enabled in explicit children. |
| `lookbook` | Interactive-media composition; hotspot internals stay private. |
| `testimonials` | Carousel shell around private testimonial composition; navigation controls stay purpose-specific. |
| `newsletter` | Shopify newsletter form with global child composition and shared Button submit. |
| `featured-product` | Product selector plus exactly the Main product layout/block contract and shared gallery/runtime. |
| `product-recommendations` | Shopify recommendation source plus standard Product card; layout parity with Featured products is enforced. |

### Catalog and search

| Section | Audit decision |
| --- | --- |
| `collection-header` | Resource-specific source; shares `catalog-header` layout with Search header. |
| `search-header` | Query-specific source; shares `catalog-header` layout with Collection header. |
| `main-collection` | Collection product source, shared catalog controls, filters, pagination, Product card, and Button clear action. |
| `main-search` | Search result source, shared catalog controls, pagination, and both standard/featured Product card compositions. |
| `main-list-collections` | Collection index source and private Collection card; layout parity with Main blog is enforced where applicable. |
| `main-blog` | Article source and private Article card; layout parity with Collection index is enforced where applicable. |

### Product, cart, content, and account routes

| Section | Audit decision |
| --- | --- |
| `main-product` | Canonical product-detail shell. Uses contextual product blocks, shared gallery, and variant JSON. |
| `pickup-availability` | Shopify section-render endpoint for selected-variant pickup; intentionally behavior-specific. |
| `main-cart` | Full cart route. Cart facts remain contextual; checkout/update/empty CTAs now use shared Button. |
| `contact-form` | Shopify contact form with global content blocks and shared Button submit. |
| `main-article` | Article/comment route; comment CTA now uses shared Button. |
| `main-password` | Password/signup route with shared Huge Text and Button renderers. |
| `main-customer` | All customer routes in one contextual shell; every CTA now uses shared Button while recovery/address `details` retain workflow semantics. |

## Native disclosure exceptions

Not every `<details>` is an Accordion block. Catalog filters and sorting,
navigation submenus, password recovery, pickup availability, and address
editors own application state or form behavior. Converting them to merchant
content composition would weaken their semantics. Accordion is for editable
children; these controls remain local but can share design tokens where useful.

## Enforcement

`bin/veylin-lint.py` now makes the architecture executable:

- R14 compares copied base settings contracts, including all Group variants
  and Accordion.
- R15 requires one shared renderer for Text, Rich text, Button, Group,
  compact card price, and catalog header families.
- R16 rejects handwritten `.btn` markup outside `snippets/button.liquid`.
- R17 requires a complete snippet graph with no missing or orphan renderers.
- R18 validates every JSON template/section group, order, referenced section,
  block order, and Shopify section/block count limit.

Any new contextual extension must be added to R14 and R15 in the same change.
