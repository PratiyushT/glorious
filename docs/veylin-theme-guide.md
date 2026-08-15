# Veylin theme guide

Veylin is a Shopify Online Store 2.0 theme built around reusable theme blocks. Merchants can preserve its art-directed default presentation or compose new layouts without editing theme code.

## Before you begin

1. Duplicate the theme before changing code or testing an app integration.
2. Add your logo, favicon, shop details, typography, colors, and icon size in **Theme settings**.
3. Configure a `main-menu` navigation and a `footer` menu in **Content > Menus**.
4. Configure storefront filters and complementary products with Shopify Search and Discovery.
5. Test product options, cart behavior, localization, customer accounts, and checkout using your own catalog before publishing.

## Brand and shop details

**Theme settings > Brand** controls the favicon and the text-based wordmark. The optional wordmark center mark replaces the first `O` with a merchant-selected image.

**Theme settings > Shop details** stores the address, map link, telephone number, and email address used by shared storefront components. These fields intentionally start empty so a newly installed theme never displays example contact information.

## Typography

Veylin uses one typography system with two layers.

### Font styles

Choose Shopify-hosted fonts for four semantic roles:

- Accent
- Body
- Subheading
- Heading

The theme loads the regular, bold, italic, and bold-italic faces for each selected font. Reusing the same font in multiple roles does not create duplicate font-face declarations.

### Text presets

Configure the reusable text presets under the same Typography setting group:

- Title
- Heading 1 through Heading 5
- Subheading
- Paragraph
- Small
- Caption

Each preset controls font style, responsive size, line height, letter spacing, and case. Text and Rich text blocks select one preset rather than maintaining unrelated typography values.

### Block overrides

Text blocks can inherit their selected preset or override:

- Font style: Accent, Body, Subheading, or Heading
- Font size: 3X-small through 8X-large
- Font color
- Line height: Tight through Loose
- Letter spacing: Tighter through Wider
- Case: As typed or a capitalization preset

Leave an override at **Default** to inherit from the text preset. Use the semantic element setting separately from appearance so headings preserve a correct page outline.

## Color schemes

Theme settings define reusable color schemes for backgrounds, text, headings, muted text, accents, borders, surfaces, buttons, and links. Each section chooses a scheme. Blocks normally inherit the section scheme and expose a color override only where a local exception is useful.

Check contrast after changing a scheme. Main text should maintain at least 4.5:1 contrast, while large text, borders, icons, and controls should maintain at least 3:1 contrast.

## Responsive presets

Veylin uses named responsive presets instead of layout sliders wherever possible. This keeps merchant choices predictable across screens and containers. Typography, spacing, icon size, product grids, section heights, card gaps, image ratios, and stacking behavior all use fluid presets.

## Global theme blocks

Global blocks can be added wherever a section accepts theme blocks.

### Text

Use Text for a single inline value such as a heading, eyebrow, label, caption, or number. Select a text preset, semantic element, spacing treatment, and optional typography overrides.

### Rich text

Use Rich text for paragraphs, lists, links, and emphasized copy. It shares the text preset and override system with Text.

### Button

One Button block represents one action. It controls its own label, link, visual style, size, radius, border width, resting colors, and hover colors. Buttons without a destination do not render a false or empty link.

### Media

Media displays a merchant-selected image, hosted video, or external video. It supports responsive size and ratio presets, focal points, fitting, loading behavior, captions, and accessible text. When no media is selected, the editor displays a lightweight Shopify placeholder.

### Icon

Icon uses the theme's centralized SVG library. The library covers interface, editorial, apparel, food, restaurant, hospitality, travel, wellness, pet, technology, retail, and product-related concepts. Choose the global responsive icon size or override it with the same preset ladder inside the block.

Add an accessible label only when the icon communicates information that nearby text does not already provide.

### Border

Border draws a rule without carrying content. It can follow the content width or span its available container.

### Accordion

Accordion is a foldable Group: it accepts child blocks, uses the same layout
controls as Group, can begin expanded, and can remain expanded on desktop while
staying collapsible on smaller screens. Its motion and plus/minus treatment are
shared with footer link columns.

### Menu, Email signup, Policy links, Payment icons, and Spacer

Menu renders one native Shopify navigation menu horizontally or vertically,
with optional nested links. Email signup is a reusable Shopify customer form.
Policy links and Payment icons read native store configuration. Spacer provides
responsive whitespace without empty content blocks.

### Group

Group is the primary layout primitive. It can contain theme blocks, app blocks, and nested Groups. Use it to arrange blocks side by side or stack them, distribute available space, align blocks, allow wrapping, make widths natural or equal, and choose container-aware stacking behavior.

Group has no reverse-order control because blocks can be reordered directly in the editor. Equal-width Groups wrap automatically without a minimum-width slider.

Optional Group borders support independent top, right, bottom, and left sides, border width, color override, internal spacing, and vertical alignment. Turning borders on does not change the Group's arrangement.

### Custom Liquid

Custom Liquid accepts merchant-authored Liquid or HTML and follows the surrounding section or Group layout. It is available wherever an app block is supported. Duplicate the theme before adding custom code. Custom code and third-party integrations are outside the standard theme support scope unless they expose a reproducible theme defect.

## Section composition

The general Group section is a flexible canvas for global and app blocks. Existing editorial areas such as feature grids, About, Visit, and Craft are saved block compositions rather than separate brand-specific section types.

Collection and search headers are also composed from global blocks. Their sections own only layout concerns such as color scheme, width, minimum height, alignment, gap, animation, and outer spacing. Add, remove, or reorder Text, Rich text, Search form, Media, Icon, Border, Button, Group, Accordion, Menu, Email signup, Policy links, Payment icons, Spacer, Custom Liquid, and app blocks as needed.

Minimum height is a floor, not a fixed height. Added content can always make the section taller.

## Header and navigation

The header uses one native Shopify menu as its navigation source. The default
art-directed layout opens it as a full-screen menu; the Classic layout renders
it inline on wide screens and keeps the same full-screen menu on compact
screens. Category shortcut blocks remain optional campaign links below the main
navigation.

The header can use different resting states on the home page and inner pages. It also contains native search, cart, and Shopify customer account entry points. New customer accounts open through Shopify's account component; legacy customer templates remain available for stores using legacy accounts.

## Footer and localization

The footer supports multiple native menus, social media icons, native store
policies, enabled payment icons, country or region selection, language
selection, Follow on Shop, and shop details. Country and language selectors
render only when the shop has more than one available option.

Leave unused social media URLs empty. Empty social links do not render.

## Product cards

Product cards are composed from private, context-aware card blocks. Merchants can arrange media, option values, option controls, price, add-to-cart behavior, and Groups without selecting a product inside every child block.

Option controls never hard-code names such as Color or Size. Target a product option automatically, by its exact Shopify name, or by its Shopify position.

Configure quick add to:

- Open product options
- Add the first available variant
- Add the most expensive available variant

For multi-option products, **Open product options** is the safest general default. Product pages and quick view support native Shopify swatches, including both swatch colors and swatch images.

## Collections and search

Collection and search pages use Shopify's native result objects, filters, sorting options, active filter URLs, result counts, and pagination. Filter names and values come from Shopify Search and Discovery; the theme does not maintain a separate catalog vocabulary.

Both product grids support responsive column and gap presets. Collection product pagination uses Shopify's pagination object and continues to work without JavaScript.

JavaScript progressively enhances filtering, sorting, pagination, and collection-to-collection changes through Shopify's Section Rendering API. Collection changes fetch the destination header and product catalog together, animate the complete server-rendered result, and update the URL without a page flash. Links and forms remain functional when JavaScript is unavailable, a request fails, or the browser cannot support the enhancement.

Search can return products, articles, pages, and other enabled resource types. Predictive search uses Shopify's predictive search endpoint. Empty searches and searches with no results display a clear next step.

Theme settings let Search behave as the art-directed menu overlay, a side
drawer, or a dedicated page. All three preserve a real `/search` form/link as
their no-JavaScript fallback.

## Blogs and articles

Blog cards are composed from Article image, Article details, Article title,
Article excerpt, and the global Button block. Reorder or remove those children
instead of maintaining a second set of show/hide controls. Article images come
from Shopify's featured article image and support its focal point, responsive
sizes, fitting, shape, captions, reveal, and low-quality loading preview; there
is no competing image uploader on the card. Card images load lazily, while the
Article page's lead image loads eagerly.

The Article template uses the same contextual blocks. Its title and excerpt
remain part of the editable header composition, while published details and
featured image can be reordered before the native article body. The body,
comments, moderation state, pagination, and previous/next links remain owned by
Shopify's article route.

## Product and Featured product

Main Product, Featured product, and Quick view use the same Product blocks,
gallery renderer, variant data, styles, and runtime. They support:

- Images, hosted video, external video, and 3D models
- Variant media changes
- Native swatches, pills, and dropdowns
- Quantity controls
- Price, compare-at price, unit price, tax information, and installments
- Add to cart and accelerated checkout
- Pickup availability
- Gift-card recipient details and scheduled delivery
- App blocks and Custom Liquid
- Carousel or stacked gallery, large first media, video-first ordering, and
  adaptive sticky Gallery/Details behavior

Featured product uses a product picker and the same native product-form behavior as the product page. Quick view is independently composed in the Header group and adds only its View full details shell link. Accelerated checkout is enabled by default on full Product surfaces but renders only when the shop has an eligible payment method.

## Product recommendations

Recommended product list uses Shopify's Product Recommendations API and can request either related or complementary products. Its layout controls mirror Product list so the two sections can maintain the same visual rhythm.

Related products are generated by Shopify. Configure complementary products in Shopify Search and Discovery. A recommendation section renders nothing when Shopify returns no recommendations.

## Quick view

Quick view supports every Shopify product media type and uses the same variant, unit-price, swatch, and add-to-cart contracts as the rest of the theme. Quick view is an enhancement; product links remain usable when JavaScript is unavailable.

## Product badges

Theme settings define one badge policy for cards and all Product surfaces.
Toggle custom, Sale, Sold out, and automatic New badges; set the New age in
days; and select a collection whose products should never show badges. Custom
badges come from product tags such as `badge:Limited edition`.

## Cart

Theme settings control both the cart page and cart drawer. They support:

- Line quantities and removal
- Line-item properties and selling plans
- Line discounts and cart discounts
- Unit price or line price display
- Cart notes
- Tax-inclusive messaging
- Shop Pay installments
- Accelerated checkout

The cart uses Shopify forms and URLs so core updates continue to work without JavaScript.

Cart page and drawer both host the same reusable Cart upsell block. Its compact
carousel intentionally composes the shared Product card down to image and
linked product name only. Choose its collection, product count, animation,
arrow position, and whether products already in the cart are excluded.

## Gift cards

Gift-card products can collect recipient email, name, message, scheduled date, and timezone offset. Recipient validation uses the standard Shopify line-item properties and does not show accelerated checkout while recipient validation is active.

The issued gift-card page displays the shop name, gift-card code, QR code, balance, expiry state, recipient details, scheduled date, print action, and Apple Wallet pass when available.

## Content templates

Veylin includes section-based templates for pages, contact, blogs, articles, collection lists, 404, search, collection, product, cart, policies, password protection, and legacy customer accounts. Article comments use Shopify's native comment form and pagination.

Shopify owns checkout. Checkout and new customer account branding are configured in Shopify admin rather than theme Liquid.

## Apps

Use Shopify app blocks wherever possible. Veylin supports app blocks alongside Custom Liquid in its composable section surfaces, main Product, and Featured product.

Before publishing an app integration:

1. Test the app block at phone, tablet, and desktop widths.
2. Test keyboard and screen-reader access.
3. Confirm the app does not intercept theme links, drawers, dialogs, or cart forms.
4. Measure performance with the app enabled and disabled.
5. Confirm the storefront still works after the app block is removed.

## Accessibility

The theme includes skip navigation, semantic headings, visible keyboard focus, labeled forms, dialog semantics, reduced-motion support, accessible carousel controls, media labels, and minimum control targets. Merchants remain responsible for meaningful image alt text, logical heading order, descriptive link labels, accessible color choices, and accessible app content.

## Performance

Use appropriately sized Shopify images and avoid autoplay video unless it is essential. Large media, many app extensions, analytics scripts, wallet code, and remote embeds can materially affect storefront performance even when theme code is unchanged.

Run Lighthouse against the latest packaged theme on a representative benchmark shop. Shopify Theme Store review averages home, product, and collection results across phone and desktop. A local Shopify development proxy is useful for comparison but is not equivalent to the Theme Store benchmark environment.

## Frequently asked questions

### Why does a setting inherit instead of showing a fixed value?

Veylin separates global design tokens from local exceptions. **Default** means the block inherits its text preset, color scheme, icon size, or button setting. Select an override only for a deliberate exception.

### Why is Group stacking based on its own width?

A Group can sit inside a narrow column on a wide desktop. Container-aware behavior responds to the space the Group actually has instead of assuming that the screen width describes its layout.

### Why did a recommendation section render nothing?

Shopify returned no products for the selected recommendation type. Configure complementary products in Search and Discovery, or allow Shopify time and sales data to improve related recommendations.

### Why are filters missing?

Set up storefront filters in Shopify Search and Discovery. The theme displays the native filters Shopify provides for the current collection or search result.

### Why is accelerated checkout missing?

Shopify renders eligible payment methods only when the shop, product, market, and buyer context support them. The theme setting makes the surface available; it does not create a wallet method.

### Why are country or language selectors missing?

Each selector appears only when more than one country, region, or language is available for the storefront.

### Can I reverse a Group?

Reorder its blocks in the theme editor. The storefront order then matches the editor order and keyboard focus order.

### Can the theme customize checkout?

No. Shopify owns checkout. Eligible checkout branding and extensibility settings are configured through Shopify admin and depend on the merchant's plan.

### Should I edit theme code directly?

Use theme settings, sections, blocks, and app blocks first. If custom code is necessary, duplicate the theme before editing it and document the change. Consider hiring a Shopify Partner for unsupported custom development.

## Support policy

Theme support covers questions about Veylin settings and built-in behavior, reproducible theme defects, accessibility defects in theme-owned code, and compatibility with supported Shopify features. Theme defects and merchant questions should receive a response within two business days; critical defects should be addressed immediately.

Standard support does not include custom development, catalog entry, app configuration, third-party code repair, checkout customization, or fixing modifications made after the theme was installed. If a third-party integration exposes a reproducible issue in theme-owned code, provide steps that reproduce the issue with the integration identified.

When requesting support, include:

- First and last name
- Email address
- `.myshopify.com` store URL
- Theme name and version
- A description of the problem and steps to reproduce it
- Screenshots or a screen recording
- Whether the issue persists in an unmodified duplicate of the latest theme version

The public documentation site should link to a mobile-friendly support form with file uploads and an automatic receipt confirmation. Replace the theme's documentation URL and support email with the final public destinations before packaging a Theme Store submission.
