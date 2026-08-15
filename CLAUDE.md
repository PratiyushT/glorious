# CLAUDE.md

## Committing

**Every feature, bug fix or tweak is committed the moment it is finished and
checked — not at the end of a session, and never batched with the next one.**
"Finished" means the work is complete *and* its checks have passed:
`shopify theme check --path . --output json` returning `[]`, plus whatever
verification the change itself calls for (a measurement in the browser pane, a
range audit after touching a `range`, a grep for a rule this file states).

One commit per change, and the message says what changed and why in the same
voice as this file — the reasoning is the part worth keeping. If a change turns
out to need a follow-up fix, that is its own commit too.

Documentation goes in the same commit as the change it describes. A section of
this file that explains a feature and the code that implements it must never
arrive separately: the note is how the next pass learns why a number is what it
is.

### A theme block's name is global

**Creating `blocks/<name>.liquid` changes the meaning of every section that has
a *local* block of that name.** This is not documented anywhere obvious and it
cost a broken homepage to find.

The hero's local blocks use explicit names — `text`, `hero_detail`, `metal`,
and `hero_cta` — because a public theme block cannot reuse a surviving local
type name. The server resolves that collision before it reports a missing local
type, so the error often names an innocent neighbour rather than the duplicate.
Keep public block names globally unique.

**And upload order still matters.** A template validates against the *server's*
copy of a section schema. After renaming the hero's block types, the template
still failed — naming
   `gemstone`, the stored *key* of the renamed block — because the server still
   held the old `hero.liquid`. Forcing that file to re-upload with a real
   content change fixed it.

The remedy is the one already recorded: push `blocks/*` first, then
templates, or restart `shopify theme dev`, which does both in one pass.

### Homepage block catalogue

**`group` is deliberately unrestricted.** Its schema accepts `@theme` and
`@app`, including another Group. Do not narrow that list to protect a
contextual block: composition is the product here, and the contextual block is
responsible for being safe wherever a merchant can add it.

The homepage blocks fall into four contracts:

- **Global composition blocks** are public and require no resource context:
  `text`, `rich-text`, `button`, `discount-offer`, `border`, `media`, `icon`,
  `huge-text`, `group`, and `accordion`. Text
  covers every single inline value; Rich text is reserved for paragraphs,
  lists, links, and emphasis. Both content settings support compatible dynamic
  sources. A testimonial is private `_testimonial` structure whose quotation
  and attribution are global Text/Rich text children; there is no third public
  Quote text block.
- **Card-local data and behavior blocks are private.** Product card explicitly
  targets `_product-card-media`, `_product-card-option-values`,
  `_product-card-option-control`, `_product-card-price`, and
  `_product-card-add`; none has a resource picker because each always uses the
  card's `closest.product`. Safe contextual content blocks — Product title,
  Vendor, and Description — are also valid card children because they already
  use the shared Text/Rich text renderers and the same `closest.product` source.
  Collection card accepts Collection title and Collection image, both fixed to
  `closest.collection`, plus its private Count. The contextual image prefers
  `collection.image`, falls back to `collection.featured_image`, and has no
  competing uploader. `_collection-card-media` remains only to render older
  saved cards through the same Media renderer. Article card follows the same
  resource rule: Article title, image, details and excerpt read only
  `closest.article`; title/details use Text, excerpt uses Rich text, and image
  uses Media. The card action remains the one global Button block with its Link
  connected to the current article.
- **Card-local Group blocks preserve layout without leaking private children.**
  `_product-card-group` and `_collection-card-group` use the exact global Group
  markup and settings but explicitly target only their card's valid children.
  Product media and Collection image own their card media regions outside the
  Group. The ordinary global Group remains unrestricted everywhere else.
- **Private composition shells** begin with an underscore and are rendered
  statically by their sections: `_product-card`, `_collection-card`, and
  `_article-card`. They
  establish the card layout, link, quick-view, and interaction context, but are
  implementation structure rather than merchant-addable blocks.
- **Context-local blocks** exist only where their data or interaction gives them
  meaning: Hero's `hero_detail`, `metal`, and `hero_cta`; private collection
  count/header blocks; and Interactive media's private Hotspot and count/header
  blocks. Lookbook remains a global composition whose reusable
  `interactive-media` block replaced `scene`. The
  Hero introduction is a section field because it occupies one fixed,
  art-directed position; it is not a third text block.

**Huge Text owns the renderer; Shopify decides where its value can live.**
`blocks/huge-text.liquid` has one setting, `Value`, with no default, and calls
`snippets/huge-text.liquid` for every placement. Password can render that
theme block statically because it accepts only theme blocks. Header, Hero, and
Footer still need local section blocks whose settings the section iterates, and
Shopify rejects mixing those with a static theme block. They therefore expose
one section-level Huge Text value and call the same snippet. The old global
`wordmark`, `wordmark_mark`, and per-section show toggles do not exist. Empty
is a valid merchant choice and never falls back to the shop name. R15 enforces
the shared renderer so this platform exception cannot fork its markup.

Underscore targeting is the restriction, not a label. Product-card blocks are
accepted only by Product card and its private Group; private collection count,
header, Group, and legacy media types stay inside Collection card. Public
Collection title and Collection image are safe wherever a closest collection
exists because they own no resource picker. Hotspot
has separate private Price/Add blocks and private Group-compatible wrappers, so
it does not reopen the Product-card family through Lookbook.

### Section conversions

`about` was the first body section converted to theme blocks. It has since
become an instance of the general `group` section along with Craft and Visit;
the history below explains the block contracts that migration preserved.

- **Both of its local types converted in one commit**, because a section holds
  either its own blocks or theme blocks and never both. That is the constraint
  that sets the whole phase's order.

- **One action is one `button` block.** The former paired `buttons` instances
  were migrated into horizontal Groups containing two Button blocks. This
  keeps the original rows while giving each action one complete, independent
  editor surface.

- **Rich text is distinct from Text because its stored value is block HTML.**
  About's paragraphs remain `richtext` values rendered into `.rte.measure`;
  single inline values use Text. They share typography controls without
  nesting rich-text `<p>` markup inside another paragraph.

- **Craft, About, and Visit consume the same public `button` block.** The
  shared snippet still owns the storefront anchor, while the singular block
  owns one label, one Link, one style, and its relevant overrides.

**`featured-products` keeps its composed header through Group.** Its eyebrow
and View All action share a horizontal `space-between` Group, while the display
title remains a sibling before it. The arrangement is stored composition, not
section-specific heading fields.

**Product List, Recommended Product List, and Collection List have two vertical
spacing jobs and name both.** `gap` remains the spacing between each section's
direct header/content blocks and is labelled Vertical block spacing. `row_gap`
is the gap between wrapped card rows; it writes only `--row-gap` on the grid
track. In particular, `none` writes `0px` and never enters the column-width or
carousel-page calculation, so it cannot change card width. Product card and
Collection card have no horizontal or vertical list-gap settings: the list
owns its layout, and its Use theme default falls straight through to
`--grid-gap`. R14 keeps the two product-list section schemas in step.

**The former Promises area is now composition rather than a component.** The
homepage section is an ordinary `group` instance. Its header is a nested Group
containing two Text blocks; its item row is another Group containing five
bordered Groups. Each item is assembled from Icon, Text (including the editable
number), and Border.

- There is no `sections/promises.liquid`, `blocks/promise.liquid`, Promise
  schema, CSS counter, or card-specific layout. A merchant can remove the
  number, replace the rule, move the icon, add a button, or put the same
  composition in any other Group section without crossing a special contract.
- `icon` is a public drawing primitive. It owns icon choice, size, alignment,
  optional frame, accessible label, and color overrides; the surrounding
  Group owns layout. Its picker is intentionally broader than this homepage:
  jewelry, apparel, food and drink, hospitality, travel, wellness, pets,
  technology, retail, interface and editorial drawings share one library.
- **Icon size is a responsive preset, never a pixel slider.** Theme settings →
  Icons selects the global 3X-small–8X-large rung. An Icon block defaults to
  `Use theme setting` and may select any rung from the identical list. The
  icon ladder is separate from text because a medium glyph and medium type are
  different visual quantities, but both scales are fluid.
- **Every theme-owned icon has one implementation.** SVG markup lives only in
  the flat `snippets/icon-*.liquid` family and callers use
  `{% render 'icon', icon: 'name' %}`. Shopify themes support the standard
  `snippets/` directory but not a nested `snippets/icons/` directory, so the
  `icon-` prefix is the folder-like namespace. This includes interface marks,
  product-card controls, hero decoration and the loader.
  JavaScript toggles pre-rendered icons; it never writes SVG or character
  glyphs. R13 enforces the boundary.
- Group's `padding` is internal container spacing. It is optional and
  independent of borders, so an ordinary Group remains unchanged at the
  default `none`, while a bordered Group can hold card-like content without a
  Card block.
- A Group is a containment boundary: direct children can shrink to their
  available width and merchant text can wrap one long word. This keeps an
  equal-width heading inside its own bordered card instead of painting across
  the next card, and applies to every Group rather than to this composition.
- Numbers are ordinary text on purpose. Automatic numbering couples content
  to sibling position and needs parent-specific counters; editable text stays
  reusable and can be removed or replaced with any label.
- Responsive behavior comes from Group's equal widths, automatic wrapping,
  and container-based stacking presets. There are no feature-specific
  breakpoints, width sliders, or orphan rules.
- The Group section's **Feature grid** preset is the reusable entry point for
  other templates. It seeds three bordered Groups made only from Icon and Text
  blocks; it does not introduce another section or block type.


**`section.blocks` survives the conversion, but only as a tally.** This governs
every remaining conversion, so it is worth stating exactly. A section that
renders theme blocks still has a populated `section.blocks`:

| | |
| --- | --- |
| `size` | the real instance count |
| `id` | real, and it ends in the block's stored key |
| `type` | **always `@theme`** — never the type you declared |
| `settings` | **empty**, every one of them |
| `shopify_attributes` | **empty** |

Measured originally with a probe against the now-removed Promises section, not
assumed: five blocks came back `size=5` with ids ending `__shipping`,
`__support`, `__secure`, `__handcraft`, `__certified`, and every `type` reading
`@theme` with no settings at all.

So a section can **count and number** its blocks and cannot **read** them. That
is enough for an index, a total, an `{% if size > 1 %}` guard or a row of
controls beside the set — and it is nothing at all for anything that needs a
block's content out in the section. Reach for `content_for 'blocks'` for the
content and `section.blocks` only for the arithmetic.

**`testimonials` is the section that needed exactly that.** It looped
`section.blocks` twice — once for the quotes, once for the dots *outside* them
— and merchant blocks render as one flat flow, so the dots could never be
blocks. They stay a Liquid loop, because a dot needs only `forloop.index` for
its label and the count for its existence. The two loops stay in step by
position: both render in `block_order`, and `initQuotes` pairs quote to dot by
index. Verified: four quotes, four dots, labels "Show review 1"–"4", and the
active quote and the selected dot agreeing.

- **`forloop.first` became a better rule than it was.** The opening quote was
  marked `is-active` by Liquid so it showed at first paint and without
  scripting. The block has no index, so `base.css` now says
  `.quotes:not(:has(.quote.is-active)) .quote:first-child` — the first quote
  shows exactly while *nothing* is active. `initQuotes` needed no change.

  A plain `.quote:first-child` would have been the obvious move and is wrong:
  once the set rotates, quote 1 would stay lit under quote 3. Verified in four
  states with transitions disabled — nothing active → quote 1 lit; third
  active → quote 1 dark and quote 3 lit; first active → **byte-identical** to
  the nothing-active state (`opacity 1`, `matrix(1,0,0,1,0,0)`), which is what
  makes the hand-over interpolate nothing.

  It also fixes a case Liquid had been carrying by accident: `initQuotes`
  returns early below two quotes and marks nothing, so a section with a single
  testimonial would have sat at opacity 0. Verified — the lone quote now shows.

- **`"tag": null` again, and again load-bearing.** `.quotes` stacks every quote
  in `grid-area: 1 / 1` to cross-fade them; a generated wrapper would take that
  cell and the quotes inside it would stack vertically instead of overlapping.

**`rich-text` exposes only Text, Rich text, and Button.** Text owns the visual
preset, semantic element, and one of four spatial treatments: Standard,
Display title, Eyebrow, or Lede. Rich text owns paragraph/list/link markup. The
two content setting types both accept compatible dynamic sources, so there is
no resource-specific text block.

The Hero formerly occupied the global `text` handle with a local block. Its
introduction is now a fixed section field, which matches its fixed position and
frees `blocks/text.liquid` for every composable section. When adding a public
block handle, still check section-local block types first; setting types and
block types use the same spelling in schema files.

**Custom Liquid has one block form and one required section form.** The public
`custom-liquid` block is the composable primitive used inside Group and other
block surfaces. `sections/custom-liquid.liquid` is Shopify's Theme Store
insertion point: one section-level `liquid` setting plus ordinary scheme,
content-width, anchor, and section-spacing controls. It is enabled on every
JSON template and not in header or footer groups. R20 protects that compliance
boundary; turning the section into a Group or leaving its Liquid setting
unrendered defeats the requirement even if the block still exists.

**`newsletter` had no local blocks either, and converting it added
composability rather than collapsing anything.** That makes it a different job
from the rest of the phase and it is worth being explicit, because
its form remains section-owned while the copy above it is composable. The
section accepts only Text and Rich text for that copy.

- **The form stays the section's own and always comes last.** It is what the
  section is *for*, a merchant should not be able to remove or reorder it, and
  `content_for 'blocks'` renders one flat flow — so the blocks are the copy
  above it and the form follows. `button_label` stays a section setting for the
  same reason: it labels the form's submit, not a block.
- Verified: eyebrow / h2 / prose / form in that order with the form last, the
  `.section-eyebrow` box **18px** (the standing check that its `display: flex`
  fix holds), `label[for]` matching the input id, `contact[tags]=newsletter`
  still posted, and the submit at 67.3px. With **every block removed** the
  stack holds nothing but the form and it still works — which is the case worth
  checking, since the copy is now optional in a way it never was.

**`lookbook` is fully converted to global blocks.** The old local `scene`
block and its four numbered product slots are gone.

- **The section is only a composition surface.** It renders
  `content_for 'blocks'` once and owns only its colour scheme, outer spacing,
  and the empty tab rail that progressive enhancement fills when there is more
  than one look. Its heading, eyebrow and lede are global Text blocks in a
  global Group.
- **One look is one public `interactive-media` block.** Its campaign asset is
  the global Media block, its corner caption is global Text, and each product
  point is a private nested `_hotspot` block. Interactive media explicitly
  accepts it; the underscore keeps it out of every other global block picker.
- **The private Hotspot has only interaction settings:** product, x/y position, and
  optional video in/out seconds. Its open product card is a merchant-composed
  tree of the same global Group, Media, Text, Product Price, Button and Product
  Add-to-cart blocks used elsewhere, rendered with the hotspot product as
  `closest.product`.
- **The synchronized row is rendered once in Liquid.** JavaScript moves that
  already-rendered row from its Hotspot into the look's list, numbers the
  hotspots in stored order, and switches whole Interactive media roots. It does
  not recreate product money, URLs, forms or images.
- **Fixed list positions still use the global primitives where they apply.**
  The header is a static private Group-compatible layout containing global Text
  plus private `_hotspot-count-text`; that private boundary prevents the count
  from appearing in general Text or Group pickers. The footer action is the
  static global Button. Static means their relationship cannot be broken by
  reordering, not that their content or presentation is hardcoded.
- **This solves the old seven-render problem by moving the boundary.** The
  parent no longer tries to render one Scene into tabs, stage, cards, counts and
  rows. Each Interactive media block renders one contiguous, complete look,
  and the rail switches those complete roots.


### The product card as blocks

**`featured-products` is the first section whose *card* became blocks**, and
that is a different job from every conversion above, which moved a section's
header. `blocks/_product-card.liquid` is a static block rendered once per piece
inside the section's own loop, handed the piece through `closest.product` —
`_collection-card`'s shape exactly, and for the same reasons: one set of
settings for eight cards, and the section keeps its carousel because it is
still the thing doing the looping.

**Collection and search now use the same `_product-card` block as Featured
products.** `snippets/product-card.liquid` remains only on the design-system
diagnostic template. `theme.js` reads every
hook off the `[data-card]` root — `card.querySelector('.card__add')`,
`[data-card-price]`, `[data-card-meta]`, `[data-card-add-id]` — rather than by
walking the tree. Nothing in it traverses `.card__body`, so the markup could be
rearranged without touching a line of script. **Keep it that way**: a handler
that reaches for a parent would tie the two cards' structures together again.

**Theme settings → Catalog owns the filter word and the hidden collections.**
`catalog_filter_word` (default "Filter") is the one word the filter button and
the filter drawer's heading use — the per-section `filter_button_label` and
`drawer_heading` pair is gone, because two settings for one word is the
cart_name mistake, and "Refine" was the only second word in the system.
Sentences like "Clear filters" stay locale-owned: pluralising an arbitrary
merchant word breaks them, the same boundary the tax note settled on. The
last-resort fallback routes through the previously-dead
`collections.filters.label` key rather than a literal. `hidden_collections`
is a collection list excluded from every *automatic* enumeration — the
collections index, predictive search's rows *and its announced count*, and
the collection quick links, where hidden entries back-fill naturally through
the existing render counters. Merchant-picked lists still show them: a shop
that chose one explicitly wins. `contains` cannot compare drops, so every
check projects to handles first.

**Collection and search share one native catalogue control system.**
`snippets/catalog-controls.liquid` renders Shopify's `filters`, `sort_options`
and active-value URLs; `snippets/catalog-pagination.liquid` renders Shopify's
`paginate.parts`. The collection and search sections decide only which native
result object to pass. Filter names and values come from Search & Discovery,
and optional quick links may use collections, the first useful list filter, or
a merchant-entered filter label. No catalogue vocabulary belongs in Liquid.

- Every control is still a real GET link or form. `initCatalog` progressively
  enhances same-resource URLs with the Section Rendering endpoint, replaces
  only the owning `[data-catalog-section]`, and updates browser history after a
  complete response. A collection-to-collection link requests both the stable
  Collection header and Main collection section IDs, swaps those two rendered
  surfaces atomically with Main collection's dedicated transition style and
  speed presets, then updates title, canonical URL, navigation state, and
  history. Editorial reveal, Gentle lift, Soft fade, and None are page-change
  choices; Product grid animation remains the independent entrance behavior
  after filtering, sorting, and pagination. The current collection stays
  readable while both sections load. Reduced motion commits immediately.
  Modified clicks, cross-route forms,
  unsupported browsers, missing section markup, failed requests, and no-script
  use native navigation. While a filter, sort, clear, or pagination request is
  in flight, its root is `aria-busy` and shows the shared surface Loader over
  the dimmed results. Never build a client-side filter table or calculate result
  counts in JavaScript.
- **Catalogue headers are sections made from global blocks.**
  `collection-header` and `search-header` own only their colour, measure,
  minimum-height preset, alignment, block gap, animation, and section padding.
  Every visible piece is a block. The collection template connects global Text
  and Rich text to `collection.title` and `collection.description`; the search
  template inserts the global `search-form` block. Media, Group, Button, Icon,
  Border, apps, and later public blocks can be added and rearranged normally.
  Never put title, eyebrow, description, image, or search-form content settings
  back on the section. The section minimum heights are floors, not fixed
  heights, so added blocks can always make the header taller.
- **Search scope belongs to the Search form block; active scope belongs to
  Shopify.** `blocks/search-form.liquid` submits `type=` from its preset. Once a
  search has been performed, `main-search` reads `search.types` and carries
  that authoritative list through filters, sorting, clearing, and pagination.
  Do not duplicate a scope setting on the results section: two editor controls
  would drift and a filter submission could silently broaden the search.
- **Collection and search card gaps default to the shared product-grid token.**
  Their `gap` setting offers `theme` first, which resolves to `--grid-gap` and
  therefore matches Product List. The remaining named spacing presets are
  deliberate merchant overrides; do not route the default through
  `--block-gap`, because that token spaces a section's children rather than
  cards in a product grid.
- **Sort and filters share components and Shopify data, not just colours.**
  `snippets/catalog-sort.liquid` renders native `sort_options` as the ZIP's
  animated dropdown or a native select. `snippets/catalog-filter-drawer.liquid`
  uses the cart drawer's `.drawer`, `.overlay__veil`, `.drawer__panel`, focus
  trap, scroll lock, Escape handling, and exact entry/exit timings. The drawer
  must remain a direct child of the catalogue section, outside the sticky
  blurred control bar: `backdrop-filter` creates a containing block and would
  clip a nested fixed drawer to the bar's height.
- **Variant filters are store configuration, not a theme inference.** Shopify's
  official Search & Discovery app must expose Color, Metal, Karat, Size and any
  other option/metafield filters through `results.filters`. The theme renders
  those native list values, swatches/images and counts; it must never derive a
  second filter vocabulary from the products on the current paginated page.
  The drawer shows ten list values before a progressive “Show more”, includes
  Shopify-authoritative active-filter removal URLs, and pairs the visual price
  range with labelled numeric From/To fields.
- **A filtered product card begins on Shopify's matching variant.** In filtered
  collections and search results, Shopify makes `product.selected_variant`,
  `product.featured_media`, and `product.url` relevant to the active variant
  filters. The card leads with that media and its shared option resolver makes
  the selected value, price, badge, and add action agree. Links preserve every
  query parameter while replacing `variant`; appending a second variant or
  discarding recommendation attribution breaks that authority.
- A product URL returned by search can already carry `variant`, and a
  recommendation URL carries Shopify tracking parameters. Liquid uses
  `product-url-with-variant` and JavaScript uses `setCardVariantHref` so a card
  replaces only the variant value. Do not append a second `variant`, discard
  the remaining query, or create a second URL implementation.

**The product template is JSON and Main product and Featured product are the
same contextual block surface.** Both sections own only the two-column shell,
render the same static `_product-media-gallery`, and accept the same ordered
theme blocks for breadcrumbs, badges, vendor, title, price, description,
variant picker, quantity, buy buttons, pickup, SKU, inventory, merchant text,
collapsibles, custom Liquid, and apps. The shared gallery, rich-text renderer,
variant JSON, and contextual blocks are the implementation; neither section
may grow a second product UI. Those blocks are contextual because their value
is the current product or selected variant; ordinary editorial copy remains a
global Text/Rich text concern elsewhere.

**A transparent product navigation does not make the Announcement header part
of the viewport.** The fixed nav reserves no layout height, but the header-group
announcement remains in flow. Product gallery height and sticky position use
the announcement controller's unrounded `--announcement-layout-height` while
that bar is visible, so the first carousel frame ends exactly at the viewport
edge. The separately rounded `--announcement-bar-height` remains the nav's
subpixel-overlap guard. Closing or omitting the announcement restores the full
`100dvh` gallery.

- **A contextual resource block extends a global base; it does not invent an
  editor.** Product title, Collection title, vendor, and price carry the Text appearance
  contract minus editable content. Product description carries Rich text minus
  editable content. Collection image carries Media's presentation contract
  without an uploader or video controls. Variant pills, Add to cart, product-card Add, and the offer
  popup carry Button's complete appearance contract, with only their role and
  intentional default added. Main product and Featured product also share the
  complete layout contract, with Featured product adding only its product
  selector. `veylin-lint` R14 compares the actual schema objects so a future
  setting cannot be added to one copy and missed in the others.
- **Collection header owns arrangement, not presentation.** Its default outer
  Group still contains the reusable Collection copy Group and data-adapted
  Collection image. The section can place those two children side by side in
  either order, overlay the copy on the image, show the image alone, or show
  the copy alone. Only the overlay arrangement exposes a veil toggle, colour,
  and strength; the fallback colour is the scheme's background token. Search header
  continues to share the catalog stage but deliberately does not inherit these
  collection-resource controls, an exception recorded in R14.
- **Accordion is Group with disclosure behavior, not a second content model.**
  It accepts its own `@theme` and `@app` children, carries Group's complete
  layout contract, and renders them through `layout-group`. Its only additions
  are a heading, initial open state, divider, and whether desktop stays
  collapsible or is always expanded. The panel uses the footer's shared
  `.disclosure__*` three-layer markup and motion. `product_collapsible` remains
  readable for saved templates but has no preset; new product disclosures are
  ordinary Accordion blocks with children.
- **Every visual CTA renders through `snippets/button.liquid`.** Cart, customer,
  catalog, newsletter, contact, article, password, cookie, and offer actions
  are not exceptions. Purpose-built controls—close buttons, carousel arrows,
  quantity steppers, sorting choices—keep their own classes because they are
  interface controls, not merchant Button instances. R16 prevents `.btn`
  markup from being written anywhere else.
- **Button shape and size are universal; the remaining defaults are per style,
  and colors are per style per scheme.** Theme settings → Buttons states shape
  and size once for every button type. Filled, Outline, Link, Quiet, Arrow, and
  Arrow outline keep independent tracking, line weight, casing, and hover
  motion. A section or block override still wins locally. Every color scheme
  owns the resting and hover colors for those six styles, plus focus,
  selection, loader, veil, scrollbar, success, warning, and error colors. An
  overlay shell publishes `data-color-scheme` so its veil uses the panel's
  selected scheme even though the veil is the panel's sibling.
- **Product badges are one contextual block, not markup hidden inside Media.**
  `product_badges` owns automatic Sold out, Sale, New, and custom/metafield
  badges. The block owns the order limit and card position; Theme settings →
  Product badges owns the shared fact policy, type, shape, and state colors.
  Product cards, Main product, Featured product, collection, search, homepage,
  and recommendations all compose this same block. Sale display is one global
  six-mode policy: Off, Sale, price difference, percentage difference, or Sale
  combined with either difference. `sale-badge-label.liquid` formats every
  surface, while the product variant JSON and card option fragments carry its
  preformatted result so a picker changes badge, price, and selected variant as
  one state without browser-side money arithmetic.

- **The product-page swatch ring hugs the dot.** The selection is drawn on the
  dot itself, the card's own language — hairline off, a 2px spacer, a light
  1px stroke at 3px — with the spacer in `--c-bg`, because these swatches sit
  on the page background where the card's `--c-surface` spacer paints a
  visible white halo (the card comment's trap, mirrored). The legacy detached
  `::after` ring that floated 4.8px outside the button is gone and must stay
  gone. A card's `:focus-within` border became `:has(:focus-visible)`, and the
  card-covering link draws no outline of its own — a mouse click on Choose
  options was leaving the whole card framed in the global accent ring.
- The picker loops `product.options_with_values`; no option name or position is
  built into the section. Automatic presentation uses Shopify's native swatch
  data when present and written pills otherwise, with explicit pill, swatch,
  and dropdown presets still available.
- **`first_option` pins one complete variant option to the front.** A written
  option name — "Metal", "Size", "Karat" — is matched case-insensitively;
  that option's whole fieldset renders first while its values and every other
  option keep Shopify's catalog order. A blank or unmatched name changes
  nothing. Display order only: the selected variant, checked controls, and
  each legend's selected value are untouched.
- **Variant choices and purchase actions share one product-control height.**
  Written pills, dropdowns, Add to cart, and Shopify's unbranded Buy Now use
  `--product-control-height` (3.125rem by default) on Main product, Featured
  product, and Quick view. This is intentionally independent of the global
  Button size so a compact site-wide button choice cannot shrink only the
  purchase action beneath its selector.
- One variant synchronization path updates the hidden form id, price, compare
  price, unit price, SKU, availability wording, featured media, pickup request,
  URL, the quantity input's rule, and each option header's selected value. A
  checked control with a stale header is a failed variant update, even if the
  price changed.
- **The quantity input states the variant's own quantity rule.** Its `min`,
  `max`, `step`, and opening value come from `variant.quantity_rule` rather
  than a hardcoded 1/1 — a store whose admin sets a minimum of 2 must not
  offer 1. The rule rides through `product-variants-json` as `quantityRule`,
  and `syncVariant` re-states it when the variant changes. **Clamping is not
  enough: the value must snap onto the min-anchored increment grid.** Native
  validation's step base is the `min` attribute, so a value carried across
  variants — or typed — can be off the new grid, and an invalid value the
  theme itself wrote blocks the submit before the delegated add ever fires,
  while arrows that only add the increment ride the wrong grid forever. The
  variant hand-over and both stepper arrows therefore re-snap
  (`min + round((value − min) / increment) × increment`) before clamping.
  The no-script buy form states the opening variant's rule too, so the two
  forms cannot disagree about what quantities the shop sells; a different
  pick in its variant select is the server's to validate, since static
  markup cannot follow it. The rule drop always exists (min 1, increment 1
  when unset), so on a shop without quantity rules the rendered attributes
  are the old literals exactly.
- The gallery keeps image, hosted video, external video, and 3D model media
  native. Images open the zoom dialog; navigation changes the one visible
  media item and pauses video when it leaves the stage.
- **Ambient video pauses off screen, resumably, behind one Motion setting.**
  `video_pause_offscreen` (default on, emitted as a body attribute) gates the
  viewport engine: an autoplaying video — the Media block's ambient videos and
  the gallery's `autoplay_video`, which now carries `data-video-autoplay` too
  — pauses when less than 30% of it is visible and plays again when it
  returns, a manual pause included; coming back to an ambient video means it
  plays. Off, it starts once and plays on, the same behaviour a browser
  without IntersectionObserver gets. The gallery swipes as well: a horizontal
  swipe steps it on every product surface, the same intent test the row
  carousel makes, through the one step function its arrows use.
- **With scripting the gallery draws no native video chrome, on every product
  surface at once** — Main product, Featured product, and Quick view render
  the same gallery block, and the product card's video never had controls.
  The one merchant control is `autoplay_video` (muted, looping); off, the
  LQIP facade's accessible Play action is how a video starts, and a click on
  the stage toggles playback thereafter. `controls: true` is still *served*,
  because `theme.js` strips it on adoption and a visitor without JavaScript
  keeps the browser's own controls — for them the native chrome is the only
  way in, which is the video-LQIP contract's own sentence. External
  YouTube/Vimeo video is the exception the platform imposes: provider chrome
  lives inside the provider's iframe and cannot be removed, only left native.
  The facade's Play/Retry labels come from Liquid data attributes
  (`general.video_play` / `general.video_retry`); the English literals in
  `theme.js` are only the floor for a facade the script had to create itself.
- **Buy Now wears exactly what Add to cart wears.** The Buy buttons block
  publishes its `button_style` as `data-button-style` on `.product-buy-form`,
  because Shopify's injected payment button cannot take the theme's classes
  and CSS cannot read a sibling's settings. `main-product.css` maps that value
  to the same universal shape and size, per-style line and type details,
  scheme colors, local overrides, and hover motion used by the Add to cart
  button. The wallet control keeps a boundary
  for Shopify usability even when Link, Quiet, or Arrow is selected, but its
  color and motion still come from that selected style. Reduced motion removes
  the transform without suppressing the hover color state.
- **Rendered product controls keep one inheritance boundary.** Variant pills
  use the Button block's local overrides and otherwise inherit the universal
  Button shape, padding, and label size; they keep only the shared 50px product
  control height as a product-specific constraint. Buy Now needs its 50px
  minimum marked important because Shopify's later stylesheet otherwise puts
  it back at 44px. Quantity remains a purpose-built interface control, but its
  `Use theme setting` radius now resolves to the universal Button shape on the
  product page, Quick View, Featured product, cart page, and cart drawer.
- **Product breadcrumbs use Shopify's collection context, never browsing-page
  headings.** A contextual collection URL renders Home / Collection / Product;
  a direct product URL renders Home / the merchant-editable All products label
  / Product. Do not restore session-history inference: decorative homepage
  headings are not catalog hierarchy and previously produced labels such as
  the repeated store wordmark.
- The selected variant and quantity are submitted through Shopify's product
  form. Accelerated checkout, installments, gift-card recipients, pickup, and
  a complete no-script form remain Shopify-native features, not simulated UI.
- Tax wording remains cart-only. The product price may optionally link the
  merchant's shipping policy, but must not grow a second tax-note control.

**Recommended Product List is its own section, not a mode of Product List.**
`product-recommendations` calls Shopify's recommendation endpoint with related
or complementary intent, then renders the same static `_product-card`, global
header blocks, grid/carousel layouts, motion, arrows, alignment, colour,
height, gap, and padding system as Product List. Shopify's endpoint accepts at
most ten results, so its count stops at 10 while ordinary Product List can
render up to 50. Keep the two source contracts separate rather than exposing a
50 control that the recommendation endpoint cannot honour.

- **There is no `.card__body`, and there cannot be.** Blocks render as one flat
  sibling flow, so the element carrying the caption's padding would have to be
  a block that swallowed its siblings. The padding moves onto the children
  (`.card--composed > *`) and the photograph opts out, which is what makes it
  full-bleed.

- **One named grid row, `media`, is the whole layout.** It pins the photograph
  to the top whatever order the blocks are dragged into, and lets the
  quick-view disc claim the same row so it lies over the photograph while
  staying a sibling either of which can be removed alone — `_collection-card`'s
  hover band again. Everything else auto-places into implicit rows underneath,
  in the merchant's order.

  **Only the disc and badges can be split out that way.** `.card__arrow` is `top: 50%`
  against its containing block, so out in the card it would centre itself on
  the whole card and land over the price. The arrows and spin badge stay inside
  the image block; `product_badges` is a sibling pinned to the same named media
  grid area so it remains independently removable and reorderable.

- **A theme block cannot read its parent's settings or a sibling's, so option
  rows publish the complete variant they resolve.** Price and Add begin on the
  same selected-or-first-available variant through
  `snippets/card-option.liquid` — which prints `index||value||variant_id` and
  is captured and split. An Option control can target **Automatic, Name, or
  Position**. Name is merchant-entered and case-insensitive; no catalogue names
  are built into the theme. Position offers Shopify's three option slots. Each
  value link publishes its option index, resolved variant id and complete
  option values; `theme.js` uses that contract to keep multiple rows, price,
  Quick view and Add synchronized. Auto still prefers the first option with a
  native Shopify swatch, then the merchant's first option.

- **The theme must not assume a jewellery store, and the caption is where that
  assumption lived.** It was one element built in Liquid — the chosen metal,
  then `custom.total_carat_weight`, joined with " · " and suffixed "ct". A shop
  selling anything else got a hardcoded metafield lookup resolving to nothing
  and no way to put its own fact there. **The caption is composed now** from
  Text blocks bound to whatever metafield the shop keeps plus any literal unit.
  The live chosen option name belongs to `_product-card-option-control`, because it is
  control state updated by the same script that updates the selected swatch,
  price, and add-to-bag variant.

  The chosen value remains `[data-card-meta]`, which the script writes into; it
  is simply no longer presented as a second Product text block.

  This was written the other way one commit earlier, on the argument that the
  design states the caption as `metalName(sel) + ' · ' + carat` and only the
  control knows what was picked. The control now owns only its live value;
  merchant facts remain ordinary Text. **Fidelity to the design is not a
  licence to bake its catalogue in.**

  **"Available in 18K, 22K" went the same way.**
  `blocks/_product-card-option-values.liquid` renders the list and nothing else;
  the words beside it are a Text block in `_product-card-group`, so a shop types
  "Comes in" or "Sizes:" rather than asking the theme for a setting. Three
  things stopped being assumptions:

  - **The option is named by the merchant and matched, not positioned.** A text
    setting — "Karat", "Size" — matched case-insensitively against each
    option's name. Position is simpler and wrong on a mixed catalogue: one
    product ordered Metal, Karat and another Karat, Metal cannot both be served
    by "the second option". A product with no such option renders nothing.
  - **There is no sorting.** The block before it pulled the first number out of
    each value and zero-padded it so "9K" sorted before "22K". That is right
    for karats and arbitrary for everything else — S/M/L/XL sorts *wrongly*
    under every rule except the one the merchant already applied when they
    ordered the values in admin. Admin order is simpler and correct more often.
  - **Every value is still listed whatever the stock**, which is not an
    assumption but a rule: an option value exists because the piece can be made
    that way, and filtering on `available` would make the sentence flicker as
    inventory moved.

  **The cost of composing it is a label that cannot know whether its list is
  empty.** On a product with no matching option the values block renders
  nothing while the text block beside it still says "Available in". Nothing on
  this store hits it — all seven pieces in Most Loved carry the option — but a
  mixed catalogue would. A block cannot read its sibling's output, so the fix
  is either a `:has()` rule that hides a row whose only content is a label, or
  giving the values block its own optional label and giving up the composition.
  Neither is built; the trade was made deliberately.

  **Variant-card action is an explicit Add-to-cart block setting.** Its default
  is a real "Choose options" product link that scripting upgrades to Quick View
  on the selected variant. A merchant may instead choose Shopify's first
  available variant or the highest-priced available variant. The latter
  publishes its id, option value and rendered price for `theme.js` to synchronize
  across the separate option, Price and Add blocks; without scripting it falls
  back to Choose options rather than showing one price and posting another.

- **Text is also the one block for every fixed thing a card says.** Inside a
  composed card, `.card--composed .text-block` supplies the compact meta-line
  contract; its Caption preset and any explicit overrides still win. Literal
  separators and units use global Text, while Product title, Vendor and
  Description lock the value to `closest.product` and reuse the same shared
  Text/Rich text presentation contract. Option values is the private Text
  extension: only its option source and separator are special; layout,
  typography, alignment, wrapping, line count and spacing are Text's.

- **The tax note is a text block now, and that is how the global one gets
  retired.** `theme.js` replaces `[data-card-price]`'s whole `innerHTML` on a
  pick, which is why the snippet card must capture its note *inside* the price
  markup; a sibling is never touched, which is the arrangement the quick view
  already uses. The price and the note share a row through a `group`.

  It does not obey `settings.show_tax_note`, which reverses this file's rule
  that every surface obeys that one switch. Deliberate, on request, and the
  direction of travel: the shop-wide note is to be phased out rather than
  extended. The cost while both exist should be stated rather than discovered —
  turning the shop-wide note off leaves Most Loved saying "inc. all taxes"
  until the block is cleared. **A section-level toggle is still banned**: a
  checkbox ANDed with the shop-wide switch gives "is it on?" two answers. A
  block is present or it is not.

- **There is no "Product cards" group in the theme settings.** It is gone from
  `config/settings_schema.json` entirely, and that is the rule: a card is
  edited on the card. The frame, the fit, the scale, the views and the video on
  the image block; the button's words on the button block; the alignment and
  the quick view on the card itself. Everything that was a show/hide checkbox —
  the caption, the swatches, the note, the button — is the presence of a block.

  **Collection and search are JSON templates with static `_product-card`
  blocks now.** Their merchants edit the same card parts as Featured products;
  the legacy snippet's defaults affect only the design-system diagnostic.

  `--card-fit` and `--card-align` were compiled into `:root` from those
  settings by `theme-tokens.liquid`; they are literals in `base.css` beside the
  `--product-*` properties now, for the reason recorded there — that snippet
  compiles only *settings*, and a default that no longer has a setting behind
  it is the theme's decision rather than the merchant's. The image block and
  the card each publish their own, which is what overrides them.

- **The Views are the *card's* settings, not the Media block's**, and
  **"Show all images in a carousel" is the master switch the rest hang off.**
  Off, the card is a single photograph: nothing to preview on hover, nothing to
  step through, no arrows, no video. So the editor hides the other four —
  hover, video, video label, the label's words — behind `visible_if`, because a
  control that cannot act should not be offered. The chain is stated in Liquid
  too, so the chip is not drawn when any link in it is off.

  It was "Show arrows", which named one symptom of the thing it governs.

  **When the arrows show is two settings, split by input rather than by width.**
  A pointer can hover and a finger cannot, so "on hover" is meaningless on a
  phone and "on swipe" is meaningless on a desktop — the two tiers offer
  different middle options for that reason, not as a convenience:

  | | |
  | --- | --- |
  | Desktop | Always / **On hover** / Never |
  | Mobile and tablet | Always / **On swipe** / Never |

  Media queries at the theme's own 48rem, because the question is what kind of
  device is being used and a container query cannot ask it. "On swipe" is
  `data-card-swiped`, set by `theme.js` on any touch landing on the media and
  cleared three seconds later — the arrows arrive with the gesture that implies
  them and leave again, rather than sitting over the photograph on a screen
  where the swipe already does the job. It is set on `touchstart` rather than on
  a completed swipe because the touch that starts one and the touch that does
  not are the same event until it ends.

  **`:focus-within` rides along with every case, "Never" included.** A keyboard
  visitor who tabs to an arrow has to be able to see the one they are on; an
  arrow that is reachable and invisible is worse than one that is neither.

  **The snippet card carries none of these attributes and keeps the design's own
  behaviour**, which is why the base rule is `.card:not([data-card-arrows-wide])`.

  Verified by probing `pointer-events` rather than `opacity`, and that choice is
  the point: the arrows' opacity is transitioned, and **a browser pane that is
  not displayed never advances a transition** — it reads 0 in every state and
  looks like a broken rule. `pointer-events` is not transitioned, so it flips on
  the same frame the rule matches. All six states came back right, the desktop
  setting does not leak into the mobile tier, and a real `touchstart` on the
  media sets the attribute and reveals the arrows.

  **Which makes the isolation rule bite from the other side, and the answer is
  worth keeping.** A block cannot read its parent's settings, so the Media block
  cannot be *told* to draw fewer arrows or skip the video. So it renders
  everything it can, and the card states the answer on its own root:

  | | |
  | --- | --- |
  | `data-card-carousel="off"` | CSS takes out every slide but the first, the arrows and the chip; `theme.js` cuts its slide list to one |
  | `data-card-hover="off"` | the stylesheet's no-JavaScript swap and `theme.js`'s `shown()` both test it |
  | `data-card-video="off"` | CSS hides the spin slide, **and `theme.js` drops it from the slide list** |

  **Only the opening card image has a source at first paint.** Every later image
  is deferred behind `data-src`/`data-srcset`, and `initCards` promotes only the
  view that hover, swipe, or an arrow is actually about to show. Enabling all
  images therefore makes them reachable without downloading unopened views;
  disabling the carousel keeps the script's list at one and promotes none.

  The video needs both halves. Hiding it alone would leave the script stepping
  to something invisible, so `initCards` filters it out before it counts — and
  then hides the arrows if fewer than two views are left, since the Media block
  rendered them before that was known. Verified by turning it off: the slide is
  in the DOM at `display: none`, and stepping cycles **1 → 2 → 0 → 1 → 2 → 0**
  without ever reaching slide 3.

  **The video's chip is drawn by the card**, which is the one thing that had to
  move rather than be gated: its wording is a setting here and there is no way
  to hand a setting down to a child. `.card__spin` is absolutely positioned at
  the top of the photograph, and `.card--composed` pins the photograph to the
  `media` grid row — so the card draws it in that row exactly as it already
  draws the quick-view disc. Measured after the move: 11px down, 53px in, 34px
  tall, inside the media box and left of the disc — the geometry it had inside
  `.card__media`.

  The arrows could not follow it: `.card__arrow` is `top: 50%`, so its
  containing block has to be `.card__media` or it centres on the whole card.
  A swipe is unaffected by the arrows setting; it is the touch equivalent and
  has no control of its own.

  The design's chip reads "360°", which is true of its own footage and of
  nothing else — a shop whose video is a model wearing the piece should not
  have a chip claiming a spin. `products.video_view` is the fallback when the
  setting is cleared.

- **The framing correction stopped being a table.** It matched "bracelet",
  "earring" and "ring" against the product's type and title — earrings before
  rings, because "earrings" contains "ring" — with `custom.card_zoom` in front
  of it. One catalogue's categories and one shop's metafield, both written into
  a theme meant to sell anything.

  It is one text setting on the image block, and being a text setting it takes
  a **dynamic source**: bind it to whatever metafield a shop keeps and every
  piece gets its own figure, type a number and the row shares one, leave it and
  there is no correction. It is coerced with `| plus: 0` and tested `> 0`
  before it is printed, because a metafield one product is missing would
  otherwise emit `--card-zoom: 0` and collapse the photograph to a point.

  Product cards and every product-detail surface now use their own composable
  Media settings. Do not reintroduce a product-type lookup table in a snippet;
  use a dynamic source on the relevant Media/Gallery block when a catalogue
  needs per-product framing.

- **The swatch row is in the merchant's order.** `metal-order.liquid` — the
  design's own table of white, yellow, rose, mixed, platinum, palladium,
  sterling, fine silver — is no longer called by the card block. Reordering a
  shop's option values against a list of metals is exactly the assumption being
  cleared; on a non-metal option it was a no-op with a misleading name, and on
  a metal one it silently overrode admin. The values come off the option
  directly, and stay `product_option_value` drops rather than being flattened
  through `split`, which is what carries a merchant's native swatch — so the
  re-lookup that round trip needed is gone too. The snippet stays for the quick
  product card. Quick view uses the same Product variant picker as the full and
  featured product surfaces.

- **The quick view is two settings on the card, not a block** — show on
  desktop, show on tablet and mobile. It is the one control here that is not
  about arranging anything: the disc is a fixed corner of the photograph, and
  whether it earns its place is a question about the pointer, since a hover
  affordance on a phone is a tap target competing with the card's own link.
  Media queries rather than container queries for exactly that reason, at the
  48rem threshold `blocks/group.liquid` already stacks on. With both off the
  disc is simply absent; the card's link still opens the product page.

- **Both button labels moved onto the button.** A metal can be sold out while
  the one Liquid rendered was not, so `theme.js` swaps between two strings it
  is handed — and it read them off the card root, which was correct only while
  the words came from a theme setting both could see. The words are the button
  block's setting now, and a block cannot hand a setting to its parent, so the
  attributes live where the setting does. The script prefers the button's and
  falls back to the root's, which is what keeps the snippet card working
  untouched.

- **Swatch shape is one published property, not a second kind of dot.**
  `_product-card-option-control` writes `--swatch-radius` on the row and `.swatch-dot`
  reads it with a `50%` fallback, so the dot stays round everywhere else it is
  drawn — the quick view and the product page both leave it alone. Square
  resolves to `var(--radius-base, 0)` rather than a literal. Verified square:
  radius 0, dot still 20×20, and the selected ring still drawn, `box-shadow`
  following the corners.

- **A dynamic source binds against `closest.product` inside a static block, and
  it must end in `.value`.** Both halves were confirmed by the server rather
  than assumed — it rejected the binding with *"Metafield
  'closest.product.metafields.custom.total_carat_weight' must end with '.value'
  when not using a metafield filter"*, which proves the `closest.product` root
  was accepted and only the leaf was wrong. That is what makes
  the global Text block able to carry a shop's own product facts at all.

- **`UniqueStaticBlockId` fails a section that names the same static block id
  twice in one branch**, which the real-cards / placeholder-cards pair did.
  They collapse into one loop over `card_count`, which is already
  `min(products, limit)` where there are products and `limit` where there are
  none; indexing past the end hands the block a nil product, which is the
  placeholder every card block already renders. The carousel and the grid are
  still written out separately, because the grid must not depend on
  `{% content_for %}` surviving a `capture`.

**The original spacing comparison was verified against the legacy snippet on
`/collections/all` before that template migrated to blocks.** Every gap in the caption stack is
identical — media→title **16**, caption→swatches **0**, swatches→note **3**,
price→button **13** — with the caption row **18px** on one line, the tax note
**11.256px**, and all seven cards level. Title→caption is **6.9** against the
snippet card's 6, the caption having become a `group` and so taking the 7px
`.card--composed > .layout-group` gives a price row; a pixel, and the same rule
serving both rows is worth more than removing it.

The composed caption reads **"Yellow Gold · 1.5 ct"** from four blocks and
moves to "White Gold · 1.5 ct" on a pick, with the price and the posted variant
following and **the tax note left standing**. Two of four slides carry a real
`src`, so the deferral contract holds. Zero duplicate ids, and the add form
carries `card_form_<id>` of its own rather than Shopify's derived one. At 375px:
one column, caption and price rows each still on one line, no horizontal
overflow. The carousel layout renders the same seven composed cards at
`--row-per: 3`.

Every control was checked by flipping the stored setting and putting it back:
square swatches (radius 0, dot still 20×20, ring still drawn), the per-device
quick view (hidden at 375, shown at 800), **hover preview off** (`data-hover-off`
present and the slide no longer changes under the pointer) and **arrows off**
(none rendered). The scale setting resolves `--card-zoom: 1.15` to
`matrix(1.15, …)`, the fit to `contain`, the alignment to `left`, and the video
chip to the merchant's own "360°".

**The category table turned out to be dead code on this catalogue**, which is
worth knowing before anyone mourns it: all 12 products carry
`custom.card_zoom`, and the metafield was checked *first*, so the table decided
nothing. Measured across `/collections/all` after removing it — 12 of 12 still
scale, at 1.05 / 1.15 / 1.22 / 1.39, and 1.22 is a figure the table could never
produce. The stored card binds the same metafield through the new setting's
dynamic source, so Most Loved gets each piece's own figure rather than a row-
wide one.

**One thing this shop does see change**, and it is the assumption leaving
rather than a fault: the swatches are in admin order now — Yellow Gold then
White Gold, where the design's table put White first.

### Weight

**`assets/` was 1.69 MB and is 409.8 KB.** What went was not compressed or
optimised — it was **unreferenced**, and the scan is the part worth keeping:
take every file in `assets/` except `base.css`, `theme.js` and the licence,
and grep the whole of `sections/ snippets/ templates/ layout/ config/ locales/
blocks/ bin/` for its filename. A theme asset is reachable only through
`asset_url`, so a name that appears nowhere is dead by construction.

**12 files, 1003 KB, reached by nothing:**

- `cat-rings`, `cat-earrings`, `cat-bracelets` (993 KB of the total). The
  collection card stopped having a per-card image picker when it became a
  static theme block — it takes the photograph from the collection itself.
- the eight `metal-*.webp`, already recorded as unreferenced under "Product
  card": the swatch paints from the option value's own Color metafield and the
  same images are served from `/cdn/shop/files/`.
- `icon-bag-plus.svg`, which duplicates `snippets/icon-bag-plus.liquid`.

**Do not read a block key as a reference.** `header-group.json` has blocks keyed
`cat-rings`, `cat-earrings`, `cat-bracelets`, `cat-necklaces` and
`templates/index.json` has `metal-white` and `metal-yellow` — every one of them
a *key* carrying a label and a url, matching an asset filename by coincidence of
naming. A plain grep for those strings finds them and reads as a live
reference. Grep for the **filename with its extension**, or scan `asset_url`
call sites.

**The Splash screen's fallback photograph is gone too**, which is the other
318 KB. The section already had an `image_picker`; the demo photograph was only
what showed when a merchant had not chosen one. It is
`{{ 'lifestyle-1' | placeholder_svg_tag }}` now, as craft and the lookbook
already do. Two reasons beyond the weight: it was the original shop's
photography and not cleared for redistribution, and a theme for sale should
ship a placeholder rather than one shop's necklaces.

`.modal__media .placeholder-svg` had to join `.modal__media img` in the
stylesheet. The placeholder is an `<svg>`, so it never matched the `img` rule,
and `height: 100%` inside a `min-height` parent is indefinite — it would not
have filled the box. Verified: 433×533 for both the media box and the
placeholder.

**The remaining two files are not the problem they look like, and this is worth
reading before anyone "fixes" them.** `theme.js` is 153.5 KB on disk / 37.6 KB
gzipped, `base.css` 202.2 KB / 51.1 KB. Both figures are real and neither is
what a shopper downloads.

Three facts from the Theme Store requirements, quoted rather than remembered:

- **"Themes must not include minified `.css` or `.js` files, with the exception
  of ES6 and third-party libraries."** Minifying is *forbidden*, not required.
  The **no build step** convention is aligned with the requirements, not in
  tension with them.
- **"Shopify automatically minifies CSS files, as well as JavaScript files that
  use ES5 syntax or lower, when they're requested by the storefront."** The
  minification happens at serve time, for free.
- The performance requirement is **a Lighthouse score of 60**, averaged across
  the product, collection and home pages on desktop and mobile — with
  accessibility at **90**. It is not a byte budget. Any figure of the form "a
  ~16 KB JS budget" is not from the requirements.

**`theme.js` qualifies, and that was checked rather than assumed**: zero arrow
functions, zero `const`/`let`, zero classes, zero template literals, zero
spread, 529 `var`s. The only two `async` matches are `script.async = true`, the
DOM property — a first pass read them as the keyword and got the answer
backwards. `base.css` qualifies for being CSS at all.

What that is worth, measured by stripping comments as a stand-in for what
Shopify's minifier does: `base.css` **50.5 → 18.7 KB** gzipped (41% of its
bytes are comments), `theme.js` **37.5 → 23.8 KB** (22%). So the comments this
theme is written in cost the shopper nothing, and removing them to save weight
would be both pointless and a submission failure.

**This is fragile in one specific way, so it is checked.** One arrow function
anywhere in `assets/*.js` silently forfeits auto-minification for the whole
file — about 14 KB gzipped, with nothing to see in the source and no error
anywhere. `veylin-lint`'s **R11** fails on any ES6 construct there. Note the
dev server is no help in confirming any of this: `shopify theme dev` serves the
raw file, comments and all, so the served size only tells you about production
on a real storefront.

If the Lighthouse score does need work, the lever is what blocks rendering and
what shifts layout, not file size — `base.css` is a render-blocking
`stylesheet_tag` in `<head>`, while `theme.js` is already `defer`.

### The layout group

**`blocks/group.liquid` is the block that arranges other blocks**, and it
retires a constraint that had produced a section-specific stylesheet rule every
time it came up: merchant blocks render as one flat sibling flow, so anything
the design puts *side by side* could not be built from blocks at all. The
products list's eyebrow and its "View All" share one `space-between` row; as
plain blocks they fell onto two lines.

It belongs to no section — any section rendering `{% content_for 'blocks' %}`
can list `group`, and the group takes `@theme`, so what goes inside is the
merchant's business. Groups nest.

- **Horizontal is the default, deliberately.** A vertical group is the same
  primitive turned into a merchant-owned column, with its own alignment,
  vertical spacing, borders, and child-height choice.
- **Two elements, and the wrapper is load-bearing.** The group answers a
  question about its own width — "am I narrow enough to stack?" — and *a
  container cannot be styled by a query against itself*. So `.layout-group` is
  the container and `.layout-group__inner` is the row that responds. This theme
  has hit that trap twice before, on `.row-carousel__frame` and
  `.quick-view__frame`, where putting both on one element parsed, uploaded and
  silently never fired.
- **Direction is both data and style.** `--group-direction` drives flex layout,
  while `data-direction` scopes the intrinsic-size safeguards for nested groups.
  Omitting the attribute still made the row look correct, but a horizontal group
  inside a vertical group was measured once at the portrait media's full width
  and then laid out at its final two-column width. The outer flex item kept that
  first, much taller measurement, leaving hundreds of empty pixels below About
  and Visit. A nested group takes `width: 100%` before the vertical parent
  measures it; measured after the fix, both outer and inner boxes are 721px tall.
- **Stacking is a container query, not a media query**, so a group stacks when
  *it* is narrow — in a half-width column on a desktop exactly as on a phone.
  `stack_below` offers Fluid / tablet (48rem) / phone (30rem).
  Stacking also forces `align-items: flex-start`, since `baseline` is
  meaningless in a column and `stretch` would run a link's underline the full
  width.
- **A group must not shrink-wrap.** As a flex item it would hug its contents
  and `space-between` would have nothing to distribute — the commonest way a
  horizontal group looks like it is ignoring its own setting. It is given
  `flex: 1 1 100%` inside the section content wrappers.

Verified on the page: the group resolves `container-type: inline-size`, its
inner row `space-between` / `baseline` with the eyebrow at x=32 and the button
at x=811 across an 868px group; and at a 381px group width the query fires,
giving `column` / `flex-start` with both children at x=19.

**`sections/group.liquid` is the same primitive at section scale.** It accepts
every public theme block and app block; its own settings stop at colour scheme,
content measure, anchor, height, section padding, text alignment, and the same
direction/distribution/alignment/wrap/gap contract as the block. Both call
`snippets/layout-group-style.liquid`, so editor values cannot drift between two
Liquid implementations.

- Craft, About, and Visit are three stored instances of `type: "group"`, not
  three section files. Their content is composed from nested Group blocks,
  Media, Border, text, and Button blocks.
- **Group owns optional borders.** `show_borders` defaults off. Turning it on
  reveals width, color override, and independent top/right/bottom/left toggles.
  The border is painted on `.layout-group`; `.layout-group__inner` remains the
  unchanged flex layout, so a border choice cannot alter direction or
  distribution. Craft's specification rows and Visit's address/hours are
  ordinary Groups containing Text blocks using Eyebrow and Lede layouts. There is no
  Detail block or value-source selector.
- **Child sizing follows direction and is never hidden state.** Side by side
  exposes Children widths (Fit content / Equal width); Stacked exposes
  Children heights (Fit content / Equal height). Equal rows that allow wrapping
  use the internal 16rem floor. Equal stacked children use equal grid rows, so
  the horizontal basis cannot masquerade as a giant vertical gap. Vertical
  spacing remains the only distance between stacked children. Block order is
  always the actual visual order; About stores Content before Media instead of
  carrying a reverse-layout control.
- **Media is global.** A Shopify-hosted video wins over an image without
  deleting it; both paths keep LQIP, ratio, cover/contain, arch, offset frame,
  captions, and scroll reveal. About's arched portrait, Craft's framed video,
  and Visit's arched salon photograph are settings on this one block.
- **Border is global.** Style, weight, colour, width, alignment, and named
  before/after spacing live on the divider. Its spacing is padding so Group's
  deliberate child-margin reset cannot erase it. Visit's old section-level
  `show_rule` is now a removable Border block.

**"View All" is a `button` block now, not a bespoke link.** Its destination is
the normal Link setting, exactly like every other Button. The removed "Link
to" source picker has no replacement fallback; the editor shows the complete
destination contract in one place.

### Duplicate ids

**The home page had six elements sharing an id, and every one was generated
rather than typed.** The accessibility requirement is a Lighthouse score of 90,
and a duplicate id is both a scored failure and a real defect — a `url(#x)` or
an `aria-labelledby` binds to whichever came first.

- **`<mask id="gj-bag-plus">`, four times.** `snippets/icon-bag-plus.liquid` builds
  `bag-plus` from a mask, and the lookbook renders it four times. All four bags
  were being punched by the *first* icon's mask; it looked right only because
  the masks were identical, and removing that first icon from the DOM — a cart
  re-render, a scene swap — would have broken the other three.

  **`{% increment %}` is the obvious fix and does not work.** `{% render %}`
  isolates increment counters exactly as it isolates `assign`, so the snippet
  counted 0 every time and produced four identical ids again. Measured, not
  assumed: the same tag emits `[0][1][2]` from inside a section and `[0][1]`
  through a `capture` there, and `0` every time from inside the snippet.
  **Anything needing a per-render token in a snippet must be handed one.**

  So the `icon.liquid` dispatcher passes a caller-supplied `uid` into that
  implementation, and the two call sites build one from their loop indices.
  Verified on the page: four distinct ids, and each path's
  `url(#…)` resolving to a mask **inside its own `<svg>`** — which is the check
  worth making, not merely that it resolves.

- **`product_form_<id>`, twice over.** Shopify derives a product form's id from
  the product, and the lookbook renders a form for the same piece on its card
  *and* in its list row. `{% form %}` takes an `id`, so both now pass one.

**A single look is not exposed as a tab panel.** The global-block Lookbook
creates tabs only when it finds more than one Interactive media root. Only then
does it add `role="tabpanel"`, `aria-labelledby`, and matching tab ids; the
one-look homepage remains ordinary content with no dangling tab relationship.

Verified after: **zero duplicate ids on the home page**, no dangling ARIA
reference, and no theme `<img>` without an `alt`.

**Two of the audit's findings were the audit's own fault, and both are worth
knowing** before trusting a sweep like it:

- `<input name="id">` inside a form makes `form.id` return *the input element*,
  not the string — DOM clobbering. A duplicate-id scan collecting `el.id` gets
  `[object HTMLInputElement]` eleven times and reports a duplicate that is not
  there. Use `getAttribute('id')`.
- `aria-hidden="true"` around a focusable control is only a defect if the
  control is actually focusable. The video LQIP facade's Play button is
  `hidden` and `display: none` until it is needed, so it is not — the theme was
  right and the check was naive.

And **R12 reproduced R08's original mistake on its first run**: it read the
`{% comment %}` block *documenting* the mask id as a branch that declares one,
and flagged the innocent `nav-bag` above it. `strip_comments` first. A rule must
ignore prose about itself; this repo has now made that error twice.

### App blocks

**`@app` is *not* a theme block for the purposes of that rule, and this is the
useful half of the finding.** `{ "type": "@app" }` sits in a `blocks` array
beside locally scoped blocks without tripping `ValidLocalBlocks` — tested on
`footer`, which has three local types: `theme check` returned `[]`, the server
accepted it, and the footer rendered its social row and all four columns with
no Liquid error.

So **accepting apps never requires converting a section.** The two are
independent, and a section that remains local — `hero`, `header`, `footer` —
can still take app blocks. Anything read here that ties
the two together is wrong.

**The Theme Store's actual requirement is narrower than "every section".** It
is app-block support in the **main product section and the featured product
section**. `main-product` now carries `@app` from the start and renders it in
the same ordered details loop as its contextual product blocks. A future
single-product Featured product section must keep the same contract.

**The general `group` section carries it, as do `rich-text` and `newsletter`.**
They are the sections whose `content_for 'blocks'` renders into an ordinary
layout flow, so an app block lands somewhere sane and needs no render path of
its own — `content_for 'blocks'` renders whatever is stored. Craft, About,
Visit, and the former Promises area are all Group instances and inherit that
support.

**Two theme-block sections deliberately do not**, and each for its own
reason:

- **`testimonials`** — `.quotes` stacks every child in `grid-area: 1 / 1` and
  cross-fades them. An app block would be laid under a quote at opacity 0 and
  never seen. This is the worst of the three: it would look like the app was
  broken.
- **`collection-list`** — its header blocks render straight into `.page-width`
  with no wrapper, because `.display + .grid-auto`'s gap depends on that
  adjacency. An app block between the title and the grid breaks the rule and
  the heading loses its gap.

A section with **local** blocks needs a render path as well as the schema
entry — `{% when '@app' %}{% render block %}` inside its own loop. The footer's
loops are filtered by type (`where: 'type', 'menu'`), so an `@app` block would
match none of them and silently render nothing. Declaring the type without
adding that case is how a merchant adds an app block and sees an empty space.

### Announcements

**Adding to the bag changed a number in the corner and said nothing.** The
whole theme had two live regions and both belonged to search, so a screen
reader user could add a piece and get no confirmation that anything had
happened.

`[data-cart-status]` in the header is a `visually-hidden`
`role="status" aria-live="polite"` region, and `cartCounts()` writes to it.

- **The sentence is Liquid's, not JavaScript's.** `cart-drawer-contents.liquid`
  renders `data-cart-announce="{{ 'navigation.bag_count' | t: count: … }}"` on
  the same element that already carries the count, and `applyCartSection`
  passes it through. So pluralisation and translation stay where every other
  string in this theme lives — the same rule the product card's Add to Bag
  labels follow.
- **It sits outside the bag link.** A live region inside an interactive element
  announces unpredictably, and the link's own accessible name already ends with
  the count.
- **It starts empty**, so a page load announces nothing. The region only speaks
  once something has changed.
- **A repeat re-announces.** A live region only speaks when its content
  *differs*, and adding the same piece twice is still two events — so the text
  is cleared and re-set rather than assigned over itself.

The `role="status"` and `aria-live="polite"` pair is stated explicitly even
though the first implies the second, because engines vary in which they map.

### Shared renderers

Phase 2's collapses. Each is a snippet the sections call, which removes the
duplicated markup without the block-type migration — that is Phase 3's job, and
a block type is a data contract.

| snippet | replaced | callers |
| --- | --- | --- |
| `button.liquid` | four hand-written button pairs | about, craft, visit |
| `icon.liquid` + `icon-*.liquid` | inline SVGs, entities, CSS glyphs and JavaScript SVG strings | every theme icon caller |

- **The hero is not a caller of either, deliberately.** `.hero__choice` looks
  like a labelled row and is not one, and `.hero__cta` is not a `.btn`. The
  hero is art-directed against a fixed viewport height with its own `--hero-*`
  literals; sharing a component with it would mean either the hero drifts or
  the component grows a hero-shaped exception. Same reason its button settings
  were added and then reverted.
- **A filter cannot be used on a `render` argument**, so a caller that needs to
  know whether a link is off-site computes `link contains '://'` into a
  variable first and passes that.

### Headings

**The homepage had no `<h1>`, and four of its section titles were not headings
at all.** Measured before the fix: `h1: 0`, and Most Loved, Our Products, Our
Promises and About Us each rendered `<div class="display">`. The only real
headings below them were the five `<h3>` feature cards — so the document's
outline started at level three, under nothing.

- **The wordmark is the `h1`.** It was a `div` carrying `role="img"` and an
  `aria-label`, which announces a picture rather than a heading. It is an `h1`
  now, with the animated letters `aria-hidden` and a single
  `.visually-hidden` text node supplying the accessible name — verified as
  `"VEYLIN"`, not the doubled string `textContent` reports.

  **Spans, not divs, inside it.** An `h1` takes phrasing content and a nested
  `div` is invalid HTML; the theme has a store review to pass. The letters stay
  one element each, since the entrance animates them 60ms apart off `--letter`.

- **`.display` needs `margin-block: 0`, and that is load-bearing.** As a `div`
  it had no default margin and needed none. As an `h1`/`h2` the user agent adds
  0.83em top and bottom, which stacks on the `.display + .grid-auto` rule and
  spaces every section title differently from its neighbour. This is the same
  shape as the note about `.display` having no bottom gap of its own.

- **The level is a merchant setting**, on `blocks/text.liquid` and on the
  three sections that render `.display` from a section setting — h1 / h2 / h3 /
  not-a-heading, defaulting to h2. A Liquid guard rejects anything else rather
  than interpolating an arbitrary tag name.

  `"tag": null` on Text still holds and matters more than before:
  the block owns its one element, a generated wrapper would break the
  `.display + .grid-auto` adjacency, and changing the tag keeps both — it is
  still a single element, and the gap rule matches on the class.

Verified on the page: **one `h1`, no non-heading `.display` left, and no level
jumps** — H1 → H2 → H3 throughout. The hero still fits its viewport exactly at
1280×910 and 390×844, at zoom 1, with no horizontal overflow.

### Colour

**Every colour a merchant sees is reachable from a setting.** It was not:
`base.css` carried **79 literal hex colours** against this file's own claim that
it "hardcodes no literal size, colour or breakpoint", and they were not in
out-of-the-way places — they were the lookbook stage, the collection card's
hover band, the hero's portrait frame, the menu and search overlays, the bag
drawer's checkout button. The components that most define the theme's look were
the ones no colour setting could reach.

**Literal colour values exist only as color-setting defaults and saved
merchant choices in `config/`.** Rendered CSS, Liquid, JavaScript, and SVG use
scheme variables, setting values, `currentColor`, or the absence of paint
(`transparent` / `none`). Even fallback literals are forbidden: a fallback can
quietly keep a component looking acceptable while disconnecting it from its
selected scheme. R19 enforces this boundary across every executable theme
file, while deliberately leaving Shopify's required color defaults and the
merchant's saved color data alone.

- **The brand palette is emitted at `:root` from two schemes**, not from seven
  new colour pickers. `--c-porcelain`, `--c-ink` and `--c-gold` come from the
  **page scheme**; `--c-noir`, `--c-noir-surface`, `--c-ivory` and
  `--c-champagne` from whichever scheme is nominated the **dark** one. So there
  is still one place each colour is defined, and restyling a scheme restyles
  every surface built from it.

  The mapping was already exact — `scheme_2` *is* the design's noir palette,
  including its background, surface, text, and accent roles — so the literals
  were re-typing a scheme that existed. `--c-ivory` was already being declared
  twice as a component-scoped literal, which is this idea arrived at by hand.

- **Two routes, and which one a component takes is a real distinction.** A
  component inside a section follows that section's scheme — the lookbook is
  inside `.scheme-scheme_2` and its background is that scheme's `--c-bg`. A
  component that is dark *regardless* of the page cannot use `--c-bg` at all,
  because it may sit in a light section; those use the brand tokens. Verified
  on the page: recolouring the lookbook's scheme moves the lookbook and not the
  nav overlay, and recolouring `--c-noir` moves the nav overlay and not the
  lookbook. Both are correct.

- **`--c-noir-deep` resolves to the nominated dark background.** A separate
  fixed black would stop following that scheme, while mixing another scheme's
  text into it can lighten rather than deepen a custom palette.

- **The page's own scheme is a setting.** `layout/theme.liquid` hardcoded
  `class="scheme-scheme_1"`, so a merchant could define four schemes and never
  choose which the page itself used — every section restyleable and the ground
  under them not.

- **Scrollbar colours are settings in every scheme.** The page and every
  independently scheme-classed scroller therefore use their own resting and
  hover roles without a CSS fallback colour.

- **The fixed white behind a product thumbnail is `--c-surface` now.** The
  photography backdrop should match the merchant's surface rather than assume
  one colour.

Two traps, both hit here:

- **Replacing the old ivory literal with `var(--c-ivory)` across the file also
  changed the declaration of `--c-ivory` into a self-reference.** CSS treats
  that as invalid at computed-value time and drops it entirely. A blanket
  literal-to-token sweep has to skip the declarations *of* those tokens.
- **A `str.replace` whose anchor does not match fails silently.** Four settings
  were "added" to `config/settings_schema.json` by a script that printed
  success and changed nothing, because the anchor assumed an indentation the
  file does not use. `veylin-lint`'s R06 caught it — `settings.page_scheme` was
  referenced in Liquid and defined nowhere — where `theme check` returned `[]`,
  since it does not read that file.

### Button block

**One block renders one action.** `blocks/button.liquid` owns one label, one
Link and one style. Two actions are two Button blocks in a horizontal Group;
there is no paired Buttons block and no automatic destination source.

`snippets/button.liquid` renders the six available styles and optional local
overrides. Blank colors and `Use theme setting` preserve the current scheme and
global Button settings. Editor visibility follows the selected style:

- Filled: background and text colors.
- Outline: text, border color, border width, and shape.
- Link / Quiet link: text and underline colors.
- Arrow: text and arrow colors.
- Arrow outline: text plus one shared border-and-arrow color, border width, and
  shape.

Resting and hover colors are separate optional overrides. A blank hover value
falls back through the resting override to the scheme, so merely opening the
new editor group changes nothing. The public Button block remains a link;
section-owned commerce actions call the same snippet with `element: 'button'`
or an unavailable `span`. That keeps one appearance API without turning a form
submit into a fake link. `mutable_label` wraps only the words, leaving the
decorative arrow intact when JavaScript changes an action label.

The Splash screens section is only the collection boundary for two addable and
deletable popup-shell blocks. `_splash-screen` is Group-like: it accepts public
theme and app children and uses the shared Group renderer/settings inside its
modal shell. `_splash-newsletter` uses that same Group contract and differs
only in popup registration: it remains the target of `#newsletter` and of a
successful customer-form return. Its preset is a horizontal Media + Group
composition. Eyebrow, heading, copy, dismiss action, fine print, Media, and
both Groups are ordinary public blocks that can be removed, reordered, or
replaced. The public `email-signup` block is the one deliberate special child:
it owns the Shopify customer form, validation/success state, and optional real
discount hand-off. Newsletter is the section's default preset, not a permanent
or disableable setting. The preset's nested content Group inherits the Splash
shell's Content alignment, just like a normal Group child; merchants can still
override that child deliberately. Configured splashes wait their turn rather
than replacing another open dialog. The cookie banner also calls the shared
Button renderer. Popup behavior and consent behavior remain owned by their
shells; their UI is not a separate button system.

**A Splash discount is a real Shopify hand-off, not decorative code.** The
merchant must create the matching active code in Shopify Admin. The shared
`discount-offer` snippet renders a copy control plus
`/discount/<code>?redirect=<destination>`; following Apply therefore records
the discount in Shopify and carries it into checkout. Blank code remains a
normal destination CTA. The saved section handle and overlay name stay
`newsletter-popup` / `newsletter` for the first Newsletter block, so
existing `#newsletter` menu actions and the post-subscription return continue
to work while the editor-facing section is named Splash screens.

**Announcement header and Announcement bar are two placements of one shared
renderer.** Both expose Rotate (Previous/Next, no Pause), Marquee, the three
speed presets, Fade/Vertical slide/Horizontal slide rotation transitions,
content width, typography, messages, and links. Horizontal rotation follows
the controls: Next and autoplay travel forward while Previous reverses. Motion
pauses while out of view, on hover/focus, on a hidden tab, in reduced motion,
and while a block is selected in the Theme Editor. `announcement-header` is
header-group only, may show everywhere or on the home page only, stays sticky,
and alone measures the fixed nav offset. It alone may render the theme-wide
Text/Icon close control: Show close, Show close except on the home page, or Do
not show close.
`announcement-bar` is an ordinary addable page section with no Show on setting;
it renders in normal flow exactly where the merchant places it and cannot move
the nav or be dismissed. The header alone owns the session dismissal key. Both
expose Compact, Standard, and Tall height presets that change only em-based
vertical breathing room. Typography still determines the minimum natural
height, so larger text cannot be clipped. Whenever the selected Header state
renders no close control, initialization deletes any remembered session
dismissal before deciding visibility, so a non-dismissible announcement always
shows.

The design states its own model: *"Four variants carry every action across the
store. Pill geometry, uppercase Karla at .15em, and a single gold accent.
Nothing else."*

| style | the design's note | shape |
| --- | --- | --- |
| `filled` | primary | accent fill, inverts to ink on hover |
| `outline` | "Secondary, sits beside filled." | hairline frame, fills to ink |
| `link` | "Inline, low weight. Size guides, policies." | gold rule, no frame |
| `quiet` | — | the same, stepped back to 55% ink |
| `arrow` | "Navigational. Moves you somewhere." | gap **11 → 19px** on hover |
| `arrow_outline` | — | the arrow carrying the outline's frame, 12 → 20px |

- **`min-block-size: 44px` on every button.** The design states it — "44px
  minimum tap height" — and it is the target size WCAG asks for. The theme had
  it nowhere. It is a min-height rather than a padding floor so the link
  variants, which have no padding at all, still meet it without growing their
  type. Verified across 23 specimens: none under 44.
- **Size, radius, border width, and color overrides are inline custom
  properties, not classes.** `.btn` reads theme variables as fallbacks, so a
  button given none renders byte-identically to before the snippet existed.
  That is what makes the
  per-button control additive rather than a migration — the global setting is
  the default, not the law. Same cascade as the text alignment above.
- **`inherit` is the sentinel for "leave it to the theme setting"**, and the
  snippet tests for it rather than relying on the resolver failing to match.
  `veylin-lint`'s R05 exempts exactly that one value and still fails on any
  other unknown id — checked by injecting `pilll` and watching it fire.
- **The arrow is `aria-hidden`.** The label already says where the button goes.
  about and visit previously appended a literal `&nbsp;&nbsp;&rarr;` inside the
  link text, which every screen reader announced.
- **The hero keeps `.hero__cta` and is deliberately not converted.** It is
  art-directed against a fixed viewport height with its own `--hero-*`
  literals, so button settings there would be inert — they were added and
  reverted rather than left as controls that do nothing. Its second render
  site did gain the `shopify_attributes` it was missing: below 990px that is
  the visible CTA, and the editor could not select it.
- **Three of the design's own figures were wrong in the theme and are fixed
  here**: `button_size` `md` was 28/16/12 against the design's 34/18/13, so
  every button sat between its two sizes; `button_tracking` `md` was .16em
  against the design's .15em; and the link variants had no type step of their
  own, where the design sets them a notch smaller and looser (12px/.16em).
- **A filled button no longer carries an arrow.** about and visit had one, and
  "filled with an arrow" is not one of the design's four. The travel is now an
  explicit choice — pick `arrow` or `arrow_outline`.

### Contract margins

**A component's own block margin is declared at zero specificity, in
`:where()`.** `.section-eyebrow`'s ratio margins, `.section-lede`'s 14px, and
the composed card's meta-line shoulder used to tie, at one class each, with
every container's `> * { margin-block: 0 }` reset — so whichever sat later in
`base.css` won, and the contracts sit late. The result was the reset rules
silently losing everywhere: a gap and a margin added inside Groups, the
products list, the collection list, the catalog header, and `.stack`, which is
how text blocks grew "random margins" no setting accounted for. (The
`.collection-list__content > *` comment even named `.section-lede`'s 14px as
the thing it zeroes; at equal specificity that was never actually true.)

Demoted, the contract loses to any reset by construction, wherever either rule
lives, and a component standing alone keeps its spacing exactly as before.
Only the *margin* is demoted — typography stays at its normal weight or
unrelated rules start winning font sizes. Two structural notes: `.stack` now
carries the same child reset as every other gap owner (it had none, which is
where the rich-text and newsletter sections' extra spacing came from), and the
eyebrow's inner label zeroes its own margins at the source, because it is the
wrapper's child, not the container's — no ancestor reset can reach it. A new
component margin follows this shape or it will reintroduce the tie.

### Text alignment

**Two levels, and the block wins.** A section carries `content_alignment` and
its text blocks follow; a block carries its own `alignment`, defaulting to
`inherit`, and overrides the section when set.

A Group names its two alignment jobs rather than presenting both as generic
Alignment. **Children across the row/stack** positions the child boxes;
**Content inside children** aligns text and inline content inside those boxes.
The Group section publishes **Default child content alignment** and a nested
Group defaults to **Use section default**. The Group override appears only for
equal-width row children or full-width stacked children, where the boxes offer
real space for the choice to affect. Stored values continue to render when a
control is contextually hidden.

Horizontal Groups expose **Content after stacking** only when a responsive
stacking preset is active. The same container query that changes the row to one
column applies that choice, so it responds to the Group's available width
rather than the device name. `Use desktop content alignment` preserves the
desktop answer. Spacing follows the same axis language: Horizontal children
spacing is the column gap, Stacked children spacing is the local row gap, and
the Group section's Section vertical spacing is the inherited fallback.

- **The section publishes a custom property; it does not add a wrapper.**
  Ordinary sections put `--section-align` and `--section-align-jc` on the
  section root. The Group section puts them once on its existing shared
  `layout-group__inner`, which is also the inheritance boundary for nested
  Group overrides; it must not calculate the same alignment again on the root.
  `.display` / `.section-lede` / `.section-eyebrow` read those properties as
  their default. A new wrapper was the obvious approach and is wrong twice
  over: `.align-*`
  carries `align-items`, so on any container holding a grid it re-aligns the
  cards; and the collection list's header blocks render **straight into
  `.page-width` with no wrapper at all**, because `.display + .grid-auto`'s gap
  depends on that adjacency. Verified: with the section centred, the grid stays
  `align-items: normal` and the cards stay 682 / 682 / 712px.
- **`.section-eyebrow` aligns on `justify-content`, not `text-align`.** It is
  `display: flex`, and that is load-bearing — it is what keeps a 12px label in
  an 18px box rather than the 29.6px an inherited `--body-leading` gives it. A
  flex row does not move on `text-align`. Measured through all three states —
  default, section-set, block-overridden — the box stays 18px.
- The block's `.align-*` class beats the section's custom property on **source
  order**, both being one class of specificity, so the defaults are declared
  above `.align-*` in `base.css` and must stay there.
- Sections carrying it so far: `collection-list`, `featured-products`,
  `group`, `testimonials`, and `rich-text`, which had its own `alignment`
  first. Any other section adopts it by adding the setting and appending the
  two properties to its `section-style` render.

## The design system page

`templates/page.design-system.liquid`, reached at
`/pages/<any-page>?view=design-system` or by assigning the template to a page.

Two jobs. It is the one place the whole system is visible at once — a token
that changes shows up beside every other token it has to live with. And it is
the **visual-regression surface** the theme's invariant asks for: a homepage
exercises maybe a third of the tokens, so diffing it can only ever catch a
third of the damage.

- **It reads computed values back from the browser rather than printing the
  settings.** That distinction is the whole point. Liquid can only print what
  it *meant* to emit, and every expensive bug in this theme so far looked
  perfectly correct in source — the footer that fell through a step fallback,
  the container query that parsed and never fired, the scroll region 0px tall
  holding 823px. A custom property that resolves to nothing is invisible in
  Liquid and blank on screen; reading it back is the only way the page can say
  so, which is why an unresolved token paints itself `--c-error`.
- **Its CSS is inline in the template, not in `base.css`.** It is developer
  tooling, and shipping ~70 lines of it to every shopper on every template
  would be paying for it forever to serve nobody.
- **Every string on it is literal English, deliberately.** Translating a page
  no shopper sees would put ~90 keys into every locale a merchant maintains.
- The spacing-step specimen is the useful one to watch: eight bars whose
  heights must stay monotonic and visibly apart at every window width. Measured
  at 1280 they are 2 / 21 / 34 / 48 / 58 / 67 / 77 / 87px.

## The convention checker

```bash
python bin/veylin-lint.py
```

**Every rule this file states in prose that can be checked, is checked.** Run it
beside `shopify theme check --path . --output json`; the two do not overlap.
`--list` names the rules, `-o R05` runs one. Exit 1 on any error; warnings never
fail the run. `bin/` is not a Shopify theme directory, so nothing in it ships.

It exists because a convention held only as long as the next reader was
diligent, and this theme has already paid for that twice — see the footer under
"Spacing steps", and the block-type rename under "Things that cost time once".

| | |
| --- | --- |
| R01 | range steps are legal — Shopify validates these server-side and `theme check` does not |
| R02 | a `select`'s default is one of its own options |
| R03 | schema `t:` keys resolve, **including `config/settings_schema.json`**, which `TranslationKeyExists` does not read |
| R04 | storefront `\| t` keys resolve |
| R05 | every setting feeding a step resolver offers only ids that resolver knows |
| R06 | `settings.x` names a setting that exists |
| R07 | a stored block type exists, as a theme block or in its section's schema |
| R08 | no `href="#"` |
| R09 | no literal shop address, telephone, email or map URL outside `config/` |
| R10 | every `<img>` declares `data-image-lqip` (warning; `"off"` for a logo) |
| R11 | `assets/*.js` stays ES5 — ES6 stops Shopify auto-minifying the file |
| R12 | an icon whose SVG declares an id is rendered with a `uid` |
| R13 | all icon SVGs and glyphs live in the centralized Liquid icon library |
| R14 | specialised Text, Rich text, Media, Button, Group, and product-section surfaces retain the base settings contract, with resource titles' non-truncating Wrap subset |
| R15 | every shared settings contract calls one canonical runtime renderer |
| R16 | CTA-style `.btn` markup is emitted only by `snippets/button.liquid` |
| R17 | snippet calls resolve and no snippet is orphaned |
| R18 | JSON templates and section groups use real sections within Shopify limits |
| R19 | runtime colours use scheme tokens rather than literals |
| R20 | the required Custom Liquid section is addable on every template |
| R21 | Product title stays complete, expandable, and linked on cards |
| R22 | Collection title stays complete and Collection image remains data-adapted across headers and cards |
| R23 | Article title/image/details/excerpt stay data-adapted across Blog cards and Article pages |

**R05 is the one written from a scar.** `section-style.liquid` stopped
understanding numbers when padding became a step, the footer kept its range, and
its stored `70`/`30` matched no rung — so the resolver printed nothing, the
caller's fallback filled in `lg`, and the footer silently doubled its padding. A
resolver with a fallback absorbs a caller you forgot to convert and reports
nothing. R05 finds each resolver's `when` ids, finds every setting handed to it,
and fails if that setting is not a `select` whose every option and default are
ids the resolver actually has.

**Two things learned writing it, worth keeping.** Parse, do not pattern-match:
the recorded `range` one-liner missed 1 of 36 because its regex could not cross
the brace in `visible_if: "{{ … }}"`. And a rule must ignore prose about itself
— on its first runs, R08 flagged this repo's own comments *explaining* why
`href="#"` is banned, in three different comment syntaxes (Liquid tag, bare
`comment` inside a `{% liquid %}` block, and CSS `/* */`). Of the 15 findings in
the first run, 14 were bugs in the rules. `strip_comments`, `strip_inert` and
`strip_liquid` are why, and a new textual rule should use them.

## Shopify CLI

- **Version: 4.6.1**, installed globally via npm (`@shopify/cli`), not a project dependency.
  Binary shim: `C:\Users\PrT15\AppData\Roaming\npm\shopify.ps1`.
- **Requires Node >= 22.12.0** (the package's own `engines` field). Local Node is v24.11.0, so this is satisfied — but keep it in mind before switching Node versions or running the CLI under an older runtime (nvm, CI, Docker).
- **Upgraded 3.91.0 → 4.6.1 on 2026-08-08.** This crossed a major version, so treat 3.x-era guidance as suspect: docs, blog posts, and tutorials written against 3.x may reference flags or behavior that changed. When a command errors unexpectedly, check `shopify <topic> --help` for the current signature before assuming the invocation is wrong.
- Upgrade in place with `shopify upgrade` (the CLI's own command) or `npm install -g @shopify/cli@latest`.
- Available topics as of 4.6.1: `app`, `auth`, `config`, `doc`, `hydrogen`, `organization`, `store`, `theme`, `upgrade`.
- `shopify search <query>` and `shopify doc fetch` pull current documentation straight from shopify.dev, **but they render through a TTY and emit nothing in a non-interactive shell** (exit 0, empty output). They are useful to a human in a terminal, not to tooling. For agent use, fetch `https://shopify.dev/docs/...` over HTTP instead.
- `shopify theme check --path <dir> --output json` **does** work non-interactively and is the reliable validation gate. Exit 0 with `[]` means no offenses. Run it after any theme edit.

## Theme

Custom Online Store 2.0 theme at the repo root, implementing the "Glorious
Jewelers redesign" Claude design export. Built homepage-first.

### Source design

The design ships as a `.dc.html` prototype (Claude's reactive format:
`<x-dc>`, `dc-import`, `sc-for`, `{{ }}` bindings) — 18 pages plus shared
components, all inline styles with literal values. It is **not** in the repo:
it arrives as a zip (`Glorious Jewelers redesign (N).zip`, latest in
`D:\Downloads`). Unpack it to the scratchpad before working from it — do not
guess at its values.

**Check `ls -t D:\Downloads/*.zip` before porting anything, every time.** The
highest N is not always the one already unpacked, and a loose `.dc.html` may
sit in `D:\Downloads` ahead of the zip it came from. Work was once done against
revision 12 while 13 was already on disk; the whole port had to be re-examined.
Current revision: **17**. Checked file by file against 14: two `.dc.html`
changed and three are new, all small.

- **Bag Drawer** — the head gains a "View Full Bag" micro-link beside "Your
  Bag N", pointing at the new Cart page. **Unported, deliberately for now**:
  this theme's `cart_type` makes the drawer and the cart page alternatives,
  and a drawer that links to the page reopens that decision — surface it as
  a product question rather than quietly porting a link to a page the shop
  may have turned off.
- **Product** — the gallery is now `position: sticky; top: 0` on desktop,
  relaxing to in-flow at the mobile query. This is the design arriving at
  the theme's own sticky-column system: Adaptive already pins the gallery
  whenever it is the shorter column, and the explicit Gallery mode states
  the design's unconditional pin.
- **Glorious Cart** — a full cart page design, new. The theme's `main-cart`
  predates it; a comparison pass is future work.
- **Buttons / Glorious Buttons** — two button specimen sheets (they differ
  from each other; both are reference material, not storefront pages).

A loose `Product Card.dc.html` (2026-08-09, revision-13 era) sits in
`D:\Downloads` and matches neither 14 nor 17 — it is stale, not ahead;
ignore it.

Revision **14** (2026-08-11) was the **facets release**. Checked file by
file against 13: no `.dc.html` changed at all. It adds `gj-facets.js`, wired
into All Products and Search only, and gives `gj-variants.js`'s price filter
a karat-pinning argument (`range(id, base, purity)` — "what would these cost
in 14k"). Neither is ported: the native Search & Discovery filter system is
this theme's facets implementation.

Revision **13** (2026-08-09) was the **variants release** — it added
`gj-variants.js` and touched Product Card, Quick View, Product, Home, Bag
Drawer, Search, Account, Checkout, Lookbook, 404, About, Order and Return.

`gj-variants.js` is **deliberately not ported, in any form.** It is a
client-side price simulator — per-metal and per-purity multipliers, a
round-to-$10 rule, a charm-price trick — standing in for data this store
already has. Shopify variants carry their own prices, and a theme-computed
price that disagrees with what checkout charges is worse than no feature. What
ports is the *shape* of its UI, driven by `product.options_with_values` and
`product.variants`. Its swatch gradients are the exception and are quoted into
`snippets/metal-swatch.liquid`.

Its *state* is the part that does not transfer: `localStorage`
(`gj-cart`, `gj-account`, `gj-orders`, `gj-wishlist`, `gj-addresses`,
`gj-returns`), which maps to real Shopify cart/customer/order objects here.

### 1:1 by default

**The design is the specification, not a mood board.** Defaults reproduce it
exactly — type sizes, font stacks, breakpoints, grid areas, easing curves,
animation delays, colours, copy. Settings exist so a merchant can *depart*
from the design, never so the theme starts somewhere near it. If a setting's
default and the design disagree, the default is a bug.

That cuts both ways: when porting a component, read its `.dc.html` and carry
the numbers over rather than re-deriving them from the theme's scales. Where
the design's value cannot be expressed as a token (see the hero, below), keep
the literal and hold it in a component-scoped custom property so it is still
one edit away from being changed.

Brand roles taken from it: porcelain, ink, noir, ivory, champagne on dark,
deep gold on light, and error. Their values live only in merchant-editable
color schemes. Italiana display + Karla body. Square corners on cards and
imagery, pill CTAs, letterspaced uppercase micro-labels.

### Not ported

Still out of scope, all present in the design: the 3D ring viewer
(`ring3d.js`, `three-d-stage.js`) and the image-slot placeholders. The
design's **checkout page cannot become a theme template** — Shopify hosts
checkout; customising it needs Checkout Extensibility (Plus for
`checkout.liquid`).

**Every raster image uses a same-image low-quality preview, except a logo.**
This is a theme-wide contract, not a card or Quick View detail. Every
theme-controlled `<img>` must carry `data-image-lqip` with a roughly 40px
rendition of that exact source (`image_url: width: 40`, preserving any crop;
the Shopify CDN's `width=40` transform for a theme asset). The Glorious mark
and other branded vector logo/badge assets explicitly carry
`data-image-lqip="off"`. Do not use a
generic placeholder and do not merely blur the full-size request.

`theme.js` places that tiny rendition in an exact-size facade above the real
`<img>`, matching its box, `object-fit`, `object-position`, border radius and
transform for the facade's whole lifetime. It shares the image's stack level so
later controls and hover content remain above it. The responsive full source
loads untouched behind it. After `img.decode()`, only the facade's opacity
fades; never reveal the full pixels in one paint and then try to disguise the
swap by animating blur, saturation or brightness on the real image. Cached
images stay sharp; lazy images start near the viewport; deferred card slides
start when their real source is promoted; a mutation observer covers Quick
View, predictive search, cart re-renders, theme-editor reloads and Shopify-CDN
images inserted in rich text or by an app, including cleanup when dynamic
content is removed mid-load. The facade remains script-owned so a visitor
without JavaScript is never left blurred. The standalone gift-card layout
implements the same overlap-and-fade contract locally because it does not load
`theme.js` or `base.css`.

**Every hosted or external video uses a same-video low-quality preview frame.**
Every theme-controlled `video_tag`, manual `<video>` and `external_video_tag`
must carry `data-video-lqip` from that media object's own `preview_image` at
roughly 40px wide. Keep the normal full poster and video sources untouched; do
not make the tiny rendition the actual `poster`, do not use a generic image,
and do not merely blur the full poster or partially loaded video.

Liquid renders the blurred tiny-preview facade beside the media so it covers a
full poster before first paint whenever JavaScript is available. `theme.js`
adopts that facade, matches `object-fit`, `object-position` and transform, and
loads the full poster and video untouched behind it. The tiny preview stays
blurred and fully opaque until playback has presented a genuinely advancing
frame. A poster decode, `loadeddata`, buffered `readyState`, a player document's
`load` event, or a paused cached frame is never reveal authority. The handoff
fades only the facade's opacity; it never sharpens the tiny preview.

For native media, gate the reveal on `playing` plus an advancing presented frame
(`requestVideoFrameCallback`, with an advancing-current-time paint fallback).
For external media, use the YouTube or Vimeo player API and require an actual
playing/time-advance signal. Autoplay rejection, media/player errors and reduced
motion retain the blurred preview and expose an accessible Play or Retry action;
reduced motion snaps directly to the playing video once that real-frame gate is
met. After a successful first reveal, an intentional pause keeps the real video
frame visible instead of re-blurring it. The same mutation observer covers
videos inserted or re-sourced after initial render. Without JavaScript, CSS
hides the facade so the normal full poster and controls remain usable.

`templates/gift_card.liquid` is `layout none`, so it keeps a small standalone
copy of the same handoff. Its stock Shopify card uses the CDN's tested
`width=40` rendition; if that global image is replaced, prefer a theme asset and
`asset_img_url` so the resizing contract is explicit. The Apple Wallet badge is
a vector brand logo and stays opted out, as does the generated QR code.

The design's **client-side search index (`search-index.js`) is deliberately
not ported.** Its job is done by Shopify's Predictive Search API instead —
see the search overlay below.

### Conventions

- **Brand holds the store's name and its image logo.** Theme settings → Brand
  gained `store_display_name` (used where the storefront says the shop's name
  in prose — the gift card page, the footer copyright fallback, the password
  logo's accessible name; empty falls back to `shop.name`), `logo`, and
  `logo_inverted`. The brand mark is the surface's choice through the shared
  `huge-text` renderer — header, overlay heads, footer — via each section's
  `brand_display`: Automatic (the old behaviour and the default — the logo
  when one is uploaded, letters otherwise), Wordmark, Logo, or both side by
  side with `brand_logo_side` choosing the logo's side. A logo choice with
  no logo uploaded falls back to the letters, because a brand mark that
  renders nothing is a broken header, not a choice. The inverted logo is
  still preferred on dark grounds; R15 keeps every branch in the one
  renderer. **Which of the two images a surface wears is explicit too**:
  `brand_logo_variant` on Header and Footer picks Automatic — the main
  logo, preferring the dark-background one on dark grounds — or either
  image outright, an explicit choice following into the overlay heads,
  and a choice with no matching upload keeping the automatic answer. On
  the transparent product nav the bar may rest in the *other* logo
  (`brand_logo_variant_transparent`), because an image cannot follow the
  borrowed brand tokens the way the letters follow `currentColor`; the
  renderer stacks the two renditions only when they actually differ (the
  second a decorative `aria-hidden` duplicate), the nav state chooses
  which shows, and a merchant-toggleable fade (`brand_logo_swap_fade`,
  emitted as `data-nav-logo-fade`) rides the bar's own 0.4s ground
  transition so logo and background hand over as one movement. **The hero deliberately stays text**: its letter-by-letter
  entrance, the nav's morph anchor, and `fitHero`'s geometry are all drawn
  from the letters. The wordmark's *text* remains the Header, Hero, and
  Footer sections' own `huge_text_value` settings — a global override would
  give "what does the wordmark say?" two answers. **The letters are only ever
  the letters.** The theme owns no emblem or monogram: the nav lockup once
  substituted a drawn mark for the first repeated letter of the wordmark, and
  that feature is removed outright — snippet, icon-library entry, CSS and
  design-system specimen — not left as a latent branch. Do not reintroduce a
  mark that stands in for any part of the merchant's own wordmark; a shop
  with a graphic mark uploads it as the Brand logo.
- **Shop details remain the source for shared shop contact facts.**
  `shop_address`, `shop_address_link`, `shop_phone`, and `shop_email` live under
  "Shop details". The Visit section's visible text is intentionally ordinary
  block content instead of another setting source.

  Consequences worth knowing:
  - Shop address, telephone, and email settings remain the shared source for
    header and footer contact information. A Button does not read them: its
    ordinary Link field is its only destination.
  - `shop_address_link` lives in `settings_data.json`, not as a schema default.
    Shopify's `url` setting type takes no `default`, so the shipped value has
    to be stored rather than declared — which is why the other three carry both
    a schema default *and* a stored value.
  - Visit's visible address and hours are literal Text blocks inside
    bordered Groups. They deliberately have no source selector. Its actions
    also store explicit Link values and do not fall back to theme settings.
  - `tel:` hrefs strip spaces, dashes and parentheses at each call site
    (`+1 (555) 010-9988` → `tel:+15550109988`). A `{% render %}` snippet cannot
    hand a value back to its caller, so this is one filter chain repeated in two
    places rather than shared.
- **No `href="#"`. A button without a destination is not rendered.** The
  pattern `{{ block.settings.button_link | default: '#' }}` shipped a control
  that looks live and goes nowhere; five of them were on the homepage. Every
  button now needs both a label *and* a link, or it does not exist. The hero
  and the bag drawer are the exception only because they fall back to a real
  route (`routes.all_products_collection_url`, `routes.root_url`) rather than
  to a fragment.

  Consequence for the editor: clearing a link removes its button. That is the
  intent — but it means a preset that ships a label with no link shows nothing
  until one is set.

  The five destinations were never invented; they are the design's own, and
  the theme had simply never carried them over: Bespoke Commissions and Old
  Gold, Renewed → `#visit`, Our Full Story → the About page, The Craft →
  `#craft`, and the Visit actions → their explicit map and email Links.
- **Anchored sections carry an `anchor` setting, not a hardcoded `id`.**
  `visit` and `craft` have one (defaulting to the design's own names) because
  things link to them — the bag drawer's "Salon", and Craft's and About's
  buttons. Before this, `/#visit` had been in `header-group.json` all along
  with nothing to land on. `.section` carries the design's own
  `scroll-margin-top: 62px` so a jump clears the fixed nav. Add the setting to
  a section when something needs to link to it; a duplicated section would
  otherwise duplicate the id.
- **All editor-facing strings are `t:` keys.** Section names, block names,
  setting labels, info text, headers and select options resolve from
  `locales/en.default.schema.json`. Storefront strings live in
  `locales/en.default.json`. Never hardcode an English label in a schema —
  add the key to the schema locale file instead. Theme check's
  `TranslationKeyExists` will catch misses.
- **No build step.** Vanilla CSS, no npm, no bundler.
- **Everything is a custom property.** `snippets/theme-tokens.liquid` compiles
  `settings_schema.json` into `:root` variables and per-scheme classes;
  `assets/base.css` hardcodes no literal size or colour. To restyle, change
  tokens, not CSS rules.

  **The hero is the one exception**, and it is deliberate. The design
  art-directs it to the pixel against a fixed viewport height, so re-deriving
  its padding, wordmark size and card geometry from the fluid scales would
  change it. Those literals live in `--hero-*` properties declared at the top
  of the `.hero` block and reassigned per breakpoint, so the default is exact
  and every number is still a single edit. Do not "fix" them into tokens.
- **Fluid for continuous values; queries for art direction.** These are two
  different jobs and the rule differs by job.

  *Continuous quantities* — type, spacing, gutters, padding, widths — are
  `clamp()` scales interpolated between 360px and 1440px, computed in Liquid
  from merchant settings; display and section headings have their own
  floor/growth/ceiling settings. Breakpoints are the wrong tool here: they put
  steps in something that should be smooth, and they would break
  merchant-editable typography, because one setting has to re-derive the whole
  scale rather than requiring every tier to be retuned by hand.

  *Discrete arrangement* is a different problem. `clamp()` interpolates a
  number — it cannot flip `flex-direction`, swap grid areas, show or hide an
  element, or produce a deliberately art-directed column count. Where the
  design encodes intent that reflow cannot infer, a query is correct. Prefer a
  **container** query on the component over a viewport media query, so the
  component stays right in a narrow section as well as on a narrow screen
  (this is why the header collapses on its own width, not the viewport's).

  Current state: layout reflows intrinsically almost throughout — grid
  `auto-fit` with a capped column count, `flex-wrap` thresholds, container
  queries on the header, the footer columns, the search overlay and the hero
  carousel.

  **The hero carries the only viewport media queries in `base.css`**, at the
  design's own 990px and 1100px. They are correct there: the design swaps grid
  *areas* between three arrangements (`b a c d` → `a b / c b` → `a b c`),
  moves the CTA between the copy column and its own row, and moves the
  carousel arrows from beside the cards to under them. None of that is a
  number `clamp()` can interpolate. They are viewport rather than container
  queries because the hero is always full-bleed and full-height — its
  container *is* the viewport.

  **The quick view carries the exceptions**, and both are about the viewport
  rather than the panel. Its gallery takes a taller floor past 64.0625rem; and
  its `details` scrolling mode is gated on `min-height: 40rem`, because whether
  that arrangement is viable at all depends on how much vertical room there is
  — a thing no container query can ask, since `container-type: size` needs a
  height that does not depend on contents. Reach for a height query only with
  that justification.

  The source design instructs mobile-first authoring with `min-width` queries.
  This theme is still mobile-first — every unprefixed declaration *is* the
  narrow-screen state, and `clamp()` floors are the mobile values — it just
  reaches for intrinsic mechanisms before breakpoints.

- **`--min-pct: 46%` lives on `.grid-auto--products`, not on the caller.** It is
  the design's own floor — `min(46%, 305px)` — so two cards stay side by side
  below the 305px column minimum. Most Loved used to pass it inline while the
  collection and search grids did not, so at 560px Most Loved showed two across
  and `/collections/all` showed one, from the same design rule. One class, one
  answer.

  The **"Columns on a phone" setting that used to drive it is gone.** Measured,
  it could only act between 441px and about 660px: every real phone width is
  below the hard override underneath, and above ~660px the 305px minimum fits
  two anyway. It was a choice about small tablets wearing a phone's name, and
  the design offers no such option.

  Now that the override reaches 660px the floor itself is nearly inert — it
  changes the count only between about 661px and 675px. It is kept because it
  is the design's own value and because without it those few pixels would show
  one column and then jump to two.
- **A sparse product row is fluid, with a panel guard.** Fixed-size cards
  used to sit at exactly the design column (`minmax(col, col)`, auto-fill),
  so three cards on a four-column row hugged the left of a field of dead
  space. The template is `auto-fit, minmax(col, 1fr)` now — empty tracks
  collapse and the live ones grow to fill, three cards filling the row
  exactly — with a separate rule capping tracks at 1.4 columns **only when
  the shell row holds at most two cells**, which is what keeps "grow" from
  becoming the two enormous feature panels the fixed-size rule exists to
  prevent. The split is not stylistic: **`auto-fit` counts its repetitions by
  the MAX track size when that is definite**, so putting the 1.4 ceiling on
  the general rule collapsed a seven-card row to two fat columns — measured,
  not assumed. `1fr` keeps the count on the column floor, so the row breaks
  where it always did and the carousel's ruler measurement is untouched. The
  rules live on
  `.grid-auto--products:not([data-row-live] *):has(.card[data-card-fixed-size])`
  — see the comments there for why the `:not()` asks about the *shell*, not
  the track, and for how "at most two cells" is asked with the ruler being
  the track's first child.
- **A product grid drops to one column below 660px**, whatever the floor above
  says. **660px is a departure from the design's 440px, on request** — it
  carries the one-column treatment through the whole band the removed "Columns
  on a phone" setting used to argue over, so a large phone in landscape and a
  small tablet in portrait get one full-width card rather than two narrow ones.
  Measured: 640px gives one column, 720px gives two.

  **Two queries carry this threshold and must move together**: the grid's own
  and `.grid-auto--products > .row-carousel__ruler`'s, since the carousel
  measures that ruler to decide how many cards make a page. Both are scoped to
  the product grid — the ruler serves any row the carousel wraps, and a
  category row must reach one column on its own floor instead. Changing one alone is how the grid and the
  carousel would quietly disagree about a column count. The design states it as a hard override —
  `@media (max-width:440px){[data-grid]{grid-template-columns:1fr !important}}`
  — because its `min(46%, 305px)` otherwise still fits two columns at 360px,
  where 46% is 165px. It is one of the few correct viewport queries here: a
  column count is not something `clamp()` can interpolate. Scoped to
  `.grid-auto--products` (Most Loved, collection, search) rather than every
  `.grid-auto`, since the category grid already reaches one column at its own
  360px floor and the blog and collection lists are not what the design means.
  No `!important` — same specificity, later in the file.
- **The feature-card row is a Group, not an art-directed grid.** Equal widths,
  automatic wrapping and gap are ordinary Group behavior. The internal 12rem
  floor keeps a card useful without exposing a width control, and the row never
  switches to section-specific layout. Removing or adding an item therefore
  reflows naturally instead of activating rules written for exactly five.

- **`--page-width` is the width of the *content*, with the gutter outside it.**
  `.page-width` therefore caps at `calc(var(--page-width) + var(--gutter) * 2)`.
  Capping the border box instead — the obvious reading — makes every section a
  gutter narrower than the design on each side, 88px in total at the top end.
  That is not just a proportion difference: it kept the four category cards
  below the 1506px they need to sit four across, so the section quietly had one
  fewer column than the design at every wide viewport.
- **`--min` on a `.grid-auto` is what decides when a row breaks**, and it has
  to be the design's own figure. The category grid's floor is 360px
  (`--min: 22.5rem`); at 20rem it fitted an extra column about 120px of width
  too early at every tier. When porting a grid, take `minmax()`'s first
  argument from the design rather than picking a round number.
- **`--grid-gap` is the gap for all three product grids** (Most Loved, Our
  Products, Our Promises). The design uses one value for the set —
  `clamp(12px, 2vw, 22px)` — and keeping them on one token is what keeps them
  reading as a set. Note it is deliberately *not* on the `--space-*` scale:
  `--space-md` lands about half again too wide.

  **The horizontal half is separately merchant-settable.** Product List,
  Collection List, and Recommended Product List each carry a `column_gap`
  select — Use theme default (which emits nothing and keeps both axes on
  `--grid-gap`), None, or a named step. It works because `.grid-auto`
  already reads `column-gap: var(--column-gap, var(--gap))` and **every**
  place a column width is computed reads the same pair — the grid template,
  the carousel ruler, the live track's `grid-auto-columns`, and the page
  translate — so one emitted property moves the columns and the grid and
  the carousel keep agreeing about the count. Emit `--column-gap` from the
  section's `grid_vars`; never restate the gap in a second place.
- Per-scheme derived colours (`--c-hairline`, `--c-shadow`, `--c-veil`) are
  emitted from each scheme's literal colours inside the scheme class, not from
  `var(--c-text)` in `:root` — custom properties inherit their *computed*
  value, so a `:root` derivation would freeze at the first scheme.
- Section padding goes through `snippets/section-style.liquid`, which resolves a
  **named step** to the design's own clamp — see "Spacing steps" below.
- Fonts are self-hosted woff2 in `assets/` (Italiana, Karla — both OFL), with
  `size-adjust` metric-matched fallbacks to avoid layout shift. Turning off
  "Use the bundled Glorious fonts" switches to Shopify's font library, and
  `layout/theme.liquid` emits `font_face` only in that case.

### Lookbook

The design's Shop the look is global composition rather than a special content
model. The section sits between Most Loved and Our Products on the homepage,
but its two behavior blocks are reusable outside that section.

- **`interactive-media` is the complete look.** It accepts ordinary global
  child blocks. Direct Media and Text children occupy the stage, while nested
  Hotspots supply the product interaction. Multiple Interactive media siblings
  become accessible tabs; a single one has no tab semantics.
- **`_hotspot` is one selected product and belongs only to Interactive media.**
  It is a private targeted block, so it is absent from general global block
  pickers. Coordinates are percentages of the
  stage. Optional appears/disappears seconds control a video window; empty
  endpoints mean unbounded. The card below the marker is a nested global-block
  composition rendered with `closest.product`.
- **Rows stay synchronized without duplicate product configuration.** Each
  Hotspot renders its Liquid product row once. `theme.js` moves it to the
  parent list and assigns the visible number from stored block order, so
  reordering Hotspots updates marker and list together.
- **The count is private Text.** `_hotspot-count-text` is targeted only by the
  Interactive media list header and filled by its controller. It uses the same
  renderer and every Text typography, colour, semantic-element and spacing
  control without exposing a contextual source selector on global Text.
- **The editor owns authoring.** Position and timing are block settings; the
  storefront has no dragging or edit mode. The Media child still owns its
  source, autoplay, looping and decorative frame. Interactive media owns the
  stage width and alignment, and can either inherit the Media child's shape and
  fit or override them for this composition.
- **The list column sticks beside the stage.** `.lookbook__list-inner` is
  `position: sticky; top: 86px` above 61.25rem (980px). Below that the
  interaction becomes one column.
- **The stage has no independent canvas height or background.** When shape is
  inherited, the Media child stays in flow and its ratio is the hotspot
  coordinate surface. An explicit Interactive media shape makes that chosen
  frame the surface instead. Either way there is no fixed 4:5 box left below
  a shorter image.


### Homepage sections

`hero`, `featured-products` (Most Loved), `collection-list` (Our Products),
`lookbook` (Shop the look), four `group` instances (feature cards, Craft,
About, Visit), and `testimonials` — plus `header`,
`announcement-header`, `header`, `cart-drawer`, composed `quick-view`,
the editor-facing Splash screens (`newsletter-popup`), and `cookie-banner` in
the header group; `footer` in the footer group; and general-purpose
`announcement-bar`, `rich-text`, and `newsletter` sections.
`predictive-search` remains a schema-less Section Rendering endpoint. Quick
view is a real header-group section with merchant-ordered Product blocks; its
saved section id is fetched against a product URL so those blocks receive the
real product context.

Most Loved's **"View all" goes to the collection it is showing**, which needs
no setting to be right, and `view_all_link` overrides it for the case where it
is not — a curated landing page, or a filtered URL. All products stands in when
no collection is chosen, so the link always has a real destination and never
becomes the `href="#"` this theme refuses to ship. Its label works the same
way: `view_all_label`, falling back to the collection's product count.

### Collection list

Our Products, renamed from `category-grid` and rebuilt on **theme blocks** —
the theme's only `blocks/` directory so far. The editor shows it as
"Collection list: Grid", which is Shopify rendering `<section name>: <preset
name>`; the second preset is "Carousel".

- **The card is one block, not one per collection.** `blocks/_collection-card.
  liquid` is a *static* block and the section renders it once per collection
  inside its own loop, handing each pass the collection it is for:

  ```liquid
  {% content_for 'block', type: '_collection-card', id: 'collection-card',
                 closest.collection: collection %}
  ```

  Four collections, four cards, **one set of settings** — the editor lists it
  once with the repeat mark. The list itself is a single `collection_list`
  section setting.

  The consequence is worth stating plainly: **nothing that must differ per card
  can live on the card.** The old per-category `title` and `image` pickers are
  gone, and the title and photograph come from the collection itself. That was
  already the fallback; what is lost is the override. The stored homepage set
  titles that matched the collections' own, except `necklaces-pendants`, whose
  card now reads whatever that collection is called in admin.
- **`_` means private.** A merchant never adds the card; the section places it.
  Only its children are in an "Add block" list. The underscore is Shopify's own
  convention for a block that exists to be rendered statically.
- **The section can keep the carousel *because* it does the looping.**
  Merchant-added blocks can only ever render as one flat sibling flow —
  `content_for 'blocks'` renders them all, and `content_for 'block'` is
  static-only, so there is no way to wrap a subset. A display-layout Text block and a card
  could therefore never share a section with a moving track. Rendering the card
  from the section's own loop sidesteps that entirely: the section still wraps
  each card in `.row-carousel__cell`, and `snippets/row-carousel.liquid` is
  untouched.

  **The loop is written twice, deliberately.** Only the carousel path captures
  its cells, because the carousel snippet takes markup; the grid — the default —
  renders inline so it cannot depend on `{% content_for %}` surviving a
  `{% capture %}`. Keep the two the same.
- **The card header is a layout-block composition, not card-specific CSS
  placement.** Its private Group-compatible wrapper spreads a nested global
  name-and-arrow Group from private `_collection-count-text`. The name is
  global Text, the arrow is global Icon, and the header owns their gaps,
  alignment, padding, responsive behavior, and bottom border. The private count
  uses the shared Text renderer and all Text typography and spacing controls;
  only its collection-derived value is fixed by context.

  The photograph and the optional hover band share the card's `media` area.
  Hover reveal is a Collection card setting, not a removable block: turning it
  on exposes only its label setting, and turning it off emits no overlay.
- **The `reveal` and its 80ms stagger live on a cell wrapper, not on the card**,
  because a theme block cannot know its place among its siblings — `forloop`
  only exists out in the section. `.collection-list__cell` is that wrapper and
  shares `.row-carousel__cell`'s rule: a grid of one, so the card fills it
  rather than sizing to its own content.
- **The header blocks render straight into `.page-width`, with no wrapper.** A
  `.display` heading has no bottom gap of its own and takes it from being
  *adjacent* to what follows; a wrapper would break that and sit the row flush
  against the title. The paragraph block was added to the same rule for the
  same reason — see "A `.display` heading has no bottom gap of its own".
- **The three header blocks are named for what they are — `title`,
  `subheading`, `paragraph` — not for the section they first appeared in**, and
  they read nothing from a parent. Any section can list them in its `blocks`
  array. This is the `fp-` → `row-` correction applied before the mistake was
  made rather than after: a shared thing named after one of its callers is how
  the next reader is misled.

  The classes follow the same rule. `.lookbook__intro` became **`.section-lede`**
  when the paragraph block became its second caller. The current Lookbook uses
  that treatment through the global Text block's Lede layout.
- **The subheading is `.section-eyebrow`, not `.section-header`.** That one is
  the row Most Loved uses to carry a micro label *and* a "view all" link, and
  it is spaced for the link: 16.5 above and 44 below a label only 18px tall.
  Under a display heading with nothing beside it that reads as a hole.

  **`display: flex` on it is load-bearing and is the whole reason the box is
  18px.** A plain block wrapper takes its strut from the inherited
  `--body-leading` (1.85), so the identical 12px label in the identical
  1.5-leaded `.micro` measured **29.6px** in a div against 18px in
  `.section-header` — which had eaten most of what the tighter margins saved.
  `.section-header` is flex for its own reasons and gets the tight box as a
  side effect; this one says why.
- **A block never renders nothing.** Both the setting *and* the preset carry
  default text, because a block guarded on `!= blank` with neither is invisible
  the moment it is added: no element in the preview, nothing for the editor to
  select or highlight, which reads as a broken block rather than an empty one.
  The preset is what "Add block" actually seeds from, so the schema default
  alone is not enough. **Any new block guarded on a setting needs both.**

### Spacing steps

**A merchant picks a step, not a number.** Section padding is a `select` of
seven named rungs — None, Extra small, Small, Medium, Large, Extra large,
Maximum — resolved by `snippets/space-step.liquid`, which prints the value and
is captured by its caller (a snippet cannot hand one back, the same shape as
`metal-order.liquid`).

A slider asked a merchant to invent a figure, let them pick 91 or 93 with no
idea which was right, and obliged the theme to look correct at fifty values.
Six rungs is six.

- **A step resolves to the design's whole `clamp(min, vw, max)` triple, not to
  one number.** This is the part that was wrong before. The design states
  section rhythm as three decisions — a floor it holds on a phone, a slope it
  ramps on, a ceiling it stops at — and `section-style.liquid` used to take one
  merchant figure and derive the other two, the floor at a flat 60% and the
  slope from `(ceiling − floor) / span`.

  It matched the design nowhere. Measured against the design's own home page,
  five of seven sections were **20–24px short at the ceiling** while carrying
  *more* padding than the design in the middle of the range, because a derived
  slope ramps from the first pixel where the design holds a floor and then
  climbs steeply. Our Products, Promises and About were `76/96` against the
  design's `96/120`; Testimonials `104/56` against `130/70`; Visit `64/96`
  against `84/120`. Most Loved (`72/72`) and The Craft (`88/88` against 90) had
  happened to land close, which is what kept it from being obvious.

- **Every rung is fluid, and no two are alike at any width.** This is a
  requirement, not an accident, and the first version of the scale failed it in
  three ways that only a rendered page revealed: `2xs` was a flat `30px` and so
  not responsive at all; `xl` and `lg` shared a 56px floor and were **identical
  on any phone**; and `sm` and `md` shared a 6vw slope, so they were the same
  value from 1024 to 1280 and parted only at the ceiling. Four of seven sizes
  were distinguishable on mobile.

  The scale is built on the design's own two relationships rather than round
  numbers — slope ≈ ceiling / 13.5 and floor ≈ 0.58 × ceiling, which is what
  its own triples do (96 → 7vw, 120 → 9vw, 70 → 5vw). Ceilings step by roughly
  1.2–1.4×, and the floors step **18 / 28 / 40 / 48 / 56 / 64 / 72** so the
  difference shows on a 360px phone first rather than only on a desktop.
  Smallest gap between adjacent rungs at any width: **6px**.

  | width | 360 | 768 | 1024 | 1440 | 1920 |
  | --- | --- | --- | --- | --- | --- |
  | `2xs` | 18 | 18 | 23 | 30 | 30 |
  | `xs` | 28 | 28 | 36 | 50 | 50 |
  | `sm` | 40 | 40 | 51 | 70 | 70 |
  | `md` | 48 | 48 | 61 | 86 | 90 |
  | `lg` | 56 | 56 | 72 | 96 | 96 |
  | `xl` | 64 | 64 | 82 | 110 | 110 |
  | `max` | 72 | 72 | 92 | 120 | 120 |

- **Two of the design's figures are not rungs**, because keeping them is what
  made the scale collide. Visit above was `clamp(40,7vw,84)` and takes `md`
  (+6 at the ceiling); Testimonials above was `clamp(72,10vw,130)` and takes
  `max` (−10). Everything else lands on the design's own ceiling: Most Loved,
  The Craft, Our Products, Promises, About, the Lookbook and the footer.

- **The footer below is fluid here and flat in the design.** The design states
  a literal `30px`; `2xs` eases it to 18 on a phone. A deliberate departure, on
  the rule that everything in this theme stays responsive.

- **The footer is converted with everything else**, and the reason is worth
  keeping. It was left on its range in the first pass, on the argument that its
  flat bottom did not belong on a fluid scale — but `section-style.liquid` had
  by then stopped understanding numbers, so the footer's stored `70` and `30`
  matched no rung, fell through to the `lg` fallback, and the footer rendered
  **89.6px top and bottom** against the ~42/27.6 it had before. The commit that
  did it said in its own message that the footer kept its slider.

  Nothing in the source looked wrong; only the rendered page showed it. **A
  resolver with a fallback will absorb a caller you forgot to convert and tell
  you nothing** — so when a shared snippet changes what it accepts, every
  caller converts in that same commit, or the fallback has to be loud.

- **An unrecognised step prints nothing, and the caller supplies the fallback.**
  Never print a bare keyword or `var(--step-)` where a length is wanted: an
  invalid value takes the whole declaration with it rather than falling back,
  so `--pad-top: ;` would drop the padding entirely.

  This is the trap that governs the rest of the slider-to-step conversion.
  Whether a setting can become a keyword depends on what consumes it, and
  *Liquid* arithmetic is not the test — **CSS** consumption is. `motion_duration`,
  `button_padding_y`, `hairline_opacity` and `shadow_opacity` all look like free
  conversions and are not: `--duration` and `--button-padding-y` sit inside
  `calc()`, and `--hairline` and `--shadow-strength` inside `color-mix()`, where
  a keyword invalidates the declaration and silently drops every transition, or
  every hairline in all four schemes at once. Those must resolve to a **number**.
  The shipped pattern is a named `select` resolved to a numeric string and
  coerced with `| times: 1.0` before the value enters arithmetic.

- **The recorded `range` audit one-liner is blind to a range and must not be
  trusted as written.** Its regex cannot cross a brace, and
  `featured-products`' `products_to_show` carries
  `"visible_if": "{{ section.settings.limit_products }}"` — the `{{ }}` breaks
  the character class and that range is skipped silently. Parse the schema
  block instead (`{%- schema -%}(.*?){%- endschema -%}` → `json.loads` →
  recursive walk); that form finds all of them. 51 ranges remain.

### Typography

**One Theme settings → Typography group owns the system.** Merchants first
choose four Shopify font-library roles — Accent, Body, Subheading and Heading —
then define ten reusable presets: Title, Heading 1–5, Subheading, Paragraph,
Small and Caption. There is no bundled-font switch and no fifth Price font;
price remains a compatibility alias of Body.

All four font pickers default to Shopify's verified `assistant_n4` handle.
Theme Check does not validate whether a non-deprecated handle exists in the
store's font library: Shopify rejected `italiana_n4` only during upload and
left the previous remote schema active, which then appeared as a page of
missing translations after the locale file uploaded successfully. A new font
default is not accepted until a strict push of `config/settings_schema.json`
confirms it server-side.

- Each preset chooses one of the four font roles, one fluid size from 3X small
  through 8X large, Tight through Loose line height, Tighter through Wider
  letter spacing, and As typed / Uppercase / Lowercase / Capitalize each word.
- A preset is visual. The HTML heading level or text element remains a separate
  semantic control wherever that decision belongs.
- All setting ids retain the `text_` prefix and the Heading 1–5 keys use
  `heading_1` … `heading_5`. `snippets/theme-tokens.liquid` loops over those
  keys and publishes font family, weight, style, size, leading, tracking and
  case variables for every preset.

**Every reusable text block selects one preset, then offers an `Override`
group.** Overrides are deliberately bounded to the same system: font can only
be Accent / Body / Subheading / Heading, size only 3X small … 8X large, line
height Tight … Loose, letter spacing Tighter … Wider and case one of the named
choices. Font colour is the only free picker. `Default` inherits the preset;
`As typed` is a distinct case override that explicitly emits no transform.

**Word breaks are a preset on the whole Text contract, with two
content-safety exceptions.** Generic Text offers Default, Pretty
(`text-wrap: pretty`), Balanced lines (`text-wrap: balance`), Single line
(ellipsis), and At most two/three lines. Collection title keeps only Default,
Pretty, and Balanced. Product title adds one non-truncating **Minimum two
lines** choice: for a title of at least three words, Liquid inserts the most
balanced word-boundary break; either side continues to wrap normally, so a
long name can occupy three lines or more. Shopify still receives and exposes
the complete resource titles on product pages, collection pages, and grids. The shared
`text-block` renderer also ignores retired truncating values stored on an older
resource-title Text block. In a composed product card the title reserves a two-line minimum
so short names align, then expands to a third line or beyond instead of hiding
words. Generic Text and product metadata retain their explicit line-count
choices. R14 permits only this narrowed option list; R21 and R22 protect the
complete resource-title contracts.

**`snippets/text-style.liquid` is the one resolver.** It guards every stored
value and prints inline declarations so a chosen preset or override wins over a
component fallback class without depending on stylesheet order. It also maps
the retired `display`, `subtitle`, `lead` and `body` values for saved blocks.
Unknown values print nothing rather than an unresolved token.

- Font picker faces are emitted in `layout/theme.liquid` with regular, bold,
  italic and bold-italic variants using Shopify's `font_modify` / `font_face`
  path. Matching role selections are signature-deduplicated before emission.
- The fluid size ladder is `--type-3xs` … `--type-8xl` in `base.css`; leading
  and tracking use the adjacent named `--lead-*` and `--track-*` ladders.
- `.display` and the legacy `--fs-*` variables remain compatibility consumers,
  but their values now point at Title, Heading 2, Paragraph and Caption preset
  tokens instead of a second typography system.

### Fluid scales

**A fluid scale is one decision, not two or three settings.** `--fs-display` is
a `clamp()` of a floor, a growth rate and a ceiling, and the theme exposed all
three as separate sliders — so a merchant wanting larger display headings had to
move `display_min`, `display_grow` and `display_max` together and keep them in
proportion, with nothing telling them the three were one choice. Two of them out
of proportion is how a heading ends up clamped to a constant, which
`theme-tokens.liquid` already had a guard for.

Five scales, thirteen endpoints, now five steps, from
`snippets/scale-step.liquid`:

| setting | was | resolves to |
| --- | --- | --- |
| `type_base` | `type_base_min`, `type_base_max` | `min,max` |
| `display_size` | `display_min`, `display_grow`, `display_max` | `min,grow,max` |
| `section_heading_size` | `section_heading_min`, `_grow`, `_max` | `min,grow,max` |
| `gutter` | `gutter_min`, `gutter_max` | `min,max` |
| `space_base` | `space_base_min`, `space_base_max` | `min,max` |

- **`md` is the reference design's own value in every one of them**, and it is
  the default — so the conversion emitted byte-identical CSS. The other four
  rungs are proportional departures, which is the rule the theme is built to:
  a setting exists so a merchant can *depart* from the design, never so the
  theme starts near it. The design states one size; only `md` is quoted from it.
- **The snippet prints numbers and the caller splits on the comma.** All five
  land in Liquid arithmetic — slopes, intercepts, ratio powers — and then inside
  a `clamp()`. `grow` stays in per-mille and `theme-tokens.liquid` divides by 10
  as it always did.
- Each capture falls back to `md` when the stored step is unknown, so a value
  from an older version of the theme degrades to the design rather than to an
  empty `clamp()`.

**Every other numeric setting is a step too**, resolved by the same snippet.
`scale-step.liquid` holds them all, so there is one place a rung is defined and
one contract — print numbers, never keywords, and let the caller append the
unit:

| setting | rungs | `md` is |
| --- | --- | --- |
| `body_leading` `display_leading` `heading_leading` | Tightest…Loosest | the design's 185 / 95 / 108 |
| `display_tracking` `heading_tracking` `button_tracking` | Tightest…Loosest | the design's 20 / 0 / 160‰ |
| `micro` | Extra small…Extra large | 12px + 220‰ |
| `radius_base` `radius_arch` `border_width` | Extra small…Extra large | 0 / 220 / 1 |
| `hairline_opacity` `shadow_opacity` | Extra small…Extra large | 14% / 55% |
| `button_size` | Extra small…Extra large | 28 / 16 / 12 |
| `button_radius` | Square / Soft / Rounded / Pill | Pill |

- **A zero rung is named for what it does, not as a size.** `radius_base` `xs`
  is Square; `border_width` and `button_border_width` `xs` are None. The plain
  Arrow is the deliberate exception: its same internal `xs` rung remains
  Extra small because the icon formula keeps a real 1px minimum stroke.
- **`micro` and `button_size` are merges, on the same argument as the fluid
  scales.** Micro size and micro tracking are one decision about a label;
  button padding-x, padding-y and label size are one decision about a button,
  and a merchant wanting a bigger button had to move three sliders and keep
  them in proportion.
- **`button_radius` is named for the shape, not sized.** A corner is a look,
  not a quantity. `pill` emits 999px, which the browser caps at half the
  shorter side — safe here only because nothing animates a *button's* radius.
  The nav animates one and must keep `calc(var(--nav-pill-h) / 2)`; a sentinel
  there crosses the cap 3.3% of the way in and the corners snap.
- **The four `color-mix()` and `calc()` consumers came through unchanged**
  because every rung is a number: `--hairline`, `--shadow-strength`,
  `--button-padding-y` and `--duration`. This is the whole reason for the
  print-numbers rule.

**72 ranges are now 18, and every survivor is genuinely continuous** — four
width measures (`page_width`, `page_width_narrow`, `content_width`,
`grid_min_column`), the lookbook's eight point coordinates, two popup delays, a
carousel interval, a column count, a product count and the nav's scroll
threshold. 89 merchant-facing theme settings are 73.

Verified on the page: **all 19 affected tokens compute identically** to the
range defaults they replaced. The one apparent difference is not one —
`--heading-tracking` serialises as `0.0em` where it was `0em`, and
`letter-spacing: 0em` computes to `normal` in Blink just as `0.0em` does.
Checked with a probe rather than assumed.

### Motion

`motion_duration` is a `select` of five named steps, resolved by
`snippets/motion-step.liquid`. The rungs are the design's own transition
durations, by how often it uses each: 250 / **350** / 500 / 700 / 900ms.

- **The snippet prints a bare number and the caller appends `ms`.** This is the
  rule for every step setting whose token reaches `calc()`, `color-mix()` or
  `clamp()`. `--duration` is read as `calc(var(--duration) * 2)` at
  `base.css:3337` and `:6245`, so a keyword there is invalid at
  computed-value time and drops the transition outright rather than falling
  back to anything. Named step selects resolved to numeric strings and coerced
  with `| times: 1.0` are the shipped precedent.
- `base` is 350ms, which is the range's own former default, and the setting has
  no stored value — so the conversion changed no pixel and no millisecond.

**The design has two motion registers, and the theme now keeps them apart.**
Measured across all 25 design pages:

- *Interaction* — a hover, a focus, a colour changing — is **plain `ease` at
  `.3s`**, and never carries a curve of its own: `color .3s` appears 107 times,
  `border-color .3s` 38, `background .3s` 11, `box-shadow .3s` 4.
- *Entrance and choreography* — reveals, modals, the nav morph, a carousel page
  — is `cubic-bezier(.22,1,.36,1)`, and always slower: .5s, .55s, .6s, .65s,
  1.1s, 1.3s.

So `--ease` is the entrance curve and **`--ease-ui` is plain `ease`**. Before
the split, `base.css` spent the entrance curve on every button, link, arrow,
swatch and field in the theme.

- **The count that set the old default was measuring the wrong thing.** An
  earlier pass read `0.35s ease` as the design's commonest transition (41
  uses) and set `--duration` to 350ms accordingly. That grep matched a duration
  *followed by an easing keyword* — and the design writes its interaction
  transitions with **no easing function at all**, leaning on the CSS initial
  value, so its ~160 `.3s` colour declarations were invisible to it. `base` is
  300ms.
- **53 declarations moved**, every one of them `color`, `background`,
  `background-color`, `border-color` or `box-shadow`. Verified on the page:
  240 UI properties now compute to plain `ease`, **none** to the entrance
  curve, and 112 non-UI properties still carry the entrance curve.
- **Three of them were single-line transitions mixing both registers** — e.g.
  `transition: width var(--duration) var(--ease), background var(--duration)
  var(--ease)` — where a line-level pass reads the first property, decides the
  line is choreography, and skips the interaction half with it. Those need
  splitting on the top-level commas. The same paren-blind mistake wrecked the
  verification sweep too: `transitionTimingFunction` split on `", "` shreds
  `cubic-bezier(0.22, 1, 0.36, 1)` into four fragments and reports nonsense.
- **`.reveal` got faster as a consequence, and that is correct.** It is
  `calc(var(--duration) * 2)`, so 350→300 took it from 0.7s to 0.6s — which is
  the design's own `transform .6s cubic-bezier(.22,1,.36,1)`.

**The keyframes are split now, and an audit against revision 17 confirms it
per declaration.** The design's animations run in three registers, not one —
so "put the animation curve on every animation" would have been exactly the
sweep this note warned against:

- `gjUp .8s` and `gjHeroLine .95s` carry `cubic-bezier(.19,1,.22,1)` — the
  page-entrance register. The theme's `catalog-title-rise` and `gj-hero-line`
  match it, and the curve is tokenized as `--ease-out`
  (`theme-tokens.liquid`), which the icon hover bounce and the arrow
  button's gap travel also read.
- `gjMenuIn`, `gjDrawerIn`, `gjModal`, `gjCkIn`, `gjLookCard`, `gjToast`,
  `gjRise`, and the All Products grid item (`gjUp .7s`, the one `gjUp` on
  this curve) carry `.22,1,.36,1` — the theme's `--ease`, which
  `gj-row-in`, `gj-drawer-in`, `gj-modal-in`, `gj-cookie-in`,
  `gj-look-card`, and `catalog-item-in` (700ms exactly) already use.
- `gjCard`, `gjFadeIn`, `gjFadeOut`, `gjDrop`, `gjCkOut`, `gjNlIn` sit on
  **plain `ease` in the design itself** — so the theme's bare-`ease`
  `animation:` lines are not the unfinished half of the split; they are the
  design's own third register, quoted. The asymmetric exits match too:
  `gjMenuOut`'s `.64,0,.78,0` and the `gjDrawerOut`/`gjModalOut`
  `.4,0,.2,1` both appear verbatim on their theme counterparts.

The theme-owned animations with no design counterpart — the loader draw, the
LQIP fades, the drawer hand-over's `gj-fade-out`/`gj-value-in`, the nested
menu branch — keep their documented, deliberate choices. Design animations
with no theme feature yet (`gjBagPop`, `gjKen`, `gjFloat`) are not ported
because their components are not.

### Block spacing

Six presets — Minimal, Tiny, Small, Medium, Large, Extra large — offered by a
theme block for its margin, padding and gap, from
`snippets/block-spacing.liquid`:

```liquid
style="{% render 'block-spacing', margin: block.settings.margin, padding: block.settings.padding %}"
```

- **`--step-minimal` is the one rung that is not on the spacing scale, and
  deliberately.** It is `0.25em` — a word space, near enough — because it
  exists for blocks that are meant to read as one sentence: "Available in" and
  "18K, 22K" on a row, a value and its unit, a name and a separator. Those want
  the space between words, which is a fact about the *text* and has to grow and
  shrink with it; every rung below is a length belonging to the page's rhythm
  and would sit visibly wrong between two halves of a phrase. It is the default
  gap for nothing — a group still opens on Medium — and it is offered wherever
  the other steps are.

- **The rest of the steps are aliases, not new numbers.** `--step-tiny` …
  `--step-xlarge` at `:root` resolve to `--space-2xs / sm / md / lg / xl`, so a
  block cannot introduce a gap the theme's own scale does not already contain. They are
  literals at `:root` beside the `--product-*` properties for the same reason:
  `theme-tokens.liquid` compiles only *settings*, and which rung "Large" means
  is the theme's decision rather than the merchant's.
- **The snippet says how much; the stylesheet says what it does.** A block
  writes `--block-margin` and its own class decides whether that is a gap
  below, a gap either side, or a ratio of the two — which is how
  `.section-eyebrow` keeps its tight-above proportion while sharing one
  merchant-facing scale with everything else.
- **The fallback lives in the CSS, and that is what makes the control
  additive.** An untouched setting prints nothing at all, so the class keeps
  exactly the spacing it had before the control existed: `.section-lede` still
  gets its 14px above and nothing below, and `.section-eyebrow` its `medium`.
  An inline custom property beats the class's own assignment, so the default
  can live where the class is defined.
- `none` exists as a token but is offered only for padding and gap — it is the
  resting value, not a choice worth making for a margin.
- An unrecognised value prints nothing rather than `var(--step-)`, which would
  be an invalid declaration and take the whole property with it.

  Measured on `.section-eyebrow` at 1440px, above / label / below /
  heading-to-row. The label box is 18px at every step, which is the check that
  the flex fix holds; and an untouched setting matches Medium exactly, which is
  the check that the CSS default and the inline property agree.

  | step | above | label | below | heading→row |
  | --- | --- | --- | --- | --- |
  | *was* `.section-header` | 16.5 | 18 | 44 | 78.5 |
  | Tiny (`2xs`) | 3 | 18 | 11 | 32 |
  | Small (`sm`) | 5 | 18 | 22 | 45 |
  | Medium (`md`, default) | 8 | 18 | 33 | 59 |
  | Large (`lg`) | 11 | 18 | 44 | 73 |
  | Extra large (`xl`) | 16 | 18 | 66 | 100 |

**The `title` block deliberately has no spacing settings.** A `.display`
heading takes its gap from being *adjacent* to what follows
(`.display + .grid-auto`), so a margin on the block would add to that rather
than replace it. Giving it the control means reworking the heading-gap rule
first.
- **`t:` keys for blocks live under a new top-level `blocks` namespace** in
  `locales/en.default.schema.json`, beside `sections` and `settings_schema`.
- Renaming the section moved "Image shape" out of `sections.category_grid` and
  into **`sections.all.image_ratio`**, where it belonged all along: `about`,
  `craft` and `visit` were all reaching into the category grid's namespace for
  that one label. `theme check` caught it, which is worth knowing — it validates
  section schemas even though it does not validate `config/settings_schema.json`.

### The row carousel

**One component, offered by two sections.** `layout` picks one of two
arrangements on **Most Loved** and on **Our Products**, and both get the same
three settings — `layout`, `carousel_motion`, `carousel_arrows`, the last two
shown only in carousel mode. Their schema strings live under `sections.all.*`
for that reason; they belong to no one section.

**Layout is per device now, and the markup is one shell in both modes.**
`layout`, `layout_tablet` and `layout_mobile` each choose grid or carousel;
`theme.js` reads them off `data-row-layout-*` and switches by `matchMedia`, so
a desktop grid can still be a phone carousel. The track is the same
`.grid-auto` element either way — grid mode is simply the shell without
`data-row-live`. Three consequences were paid for and are worth keeping:

- **`data-row-live` lives on the shell root, never on the track.** A track-level
  `:not([data-row-live])` is therefore *always true*, and `:has()` carries its
  argument's specificity — so the fixed-size capped template outweighed the live
  rule's `grid-template-columns: none` and kept painting under the carousel:
  the first auto-fill columns stayed capped while overflow cards took the
  implicit 100% column (some cards thin, some full-width), and below 660px the
  explicit `1fr` starved against the implicit columns and collapsed the
  *active* cell to 0px — which also threw its absolutely-positioned quick-view
  disc over the neighbouring card. The guard is `:not([data-row-live] *)`: a
  standalone catalog grid is inside no shell and keeps the cap, a shell in grid
  mode keeps it too, and only a live carousel steps out of it.
- **Live is granted only after a real measurement.** The bag drawer's upsell
  boots inside a `hidden` panel, where the viewport is 0 wide; a page count
  derived from that latched `--row-per: 1` and presented one full-width card
  per page, which is what crushed the cart lines and read as "no upsell with
  items". `measure()` now records whether it saw geometry, `paint()` states
  nothing until it has, and the ResizeObserver completes the hand-over on the
  frame the container first gets a size — before paint, so nothing wrong is
  ever shown.
- **The cells carry the grid layout's reveal** — 60ms apart on a product row,
  80ms on the collection row — because grid is a mode of the shell rather than
  separate markup now. Live mode steps the cell's reveal aside exactly as the
  root's is stepped aside: `gj-card` is the carousel's entrance, and two
  entrances on one element's account is the same bug twice. The upsell's cells
  deliberately carry none: they boot in a hidden drawer, where an
  IntersectionObserver cannot fire until the panel opens.

`showCarousel` restores the `aria-roledescription` Liquid rendered rather than
writing the word `carousel`, so switching layouts cannot swap a translated
role for an English literal.

`snippets/row-carousel.liquid` is the shell and **the shell only**: the root,
the arrows, the viewport with its ruler, the marks. The caller renders its own
cells — only it knows what a card is — and hands them over already wrapped in
`.row-carousel__cell` with `data-row-cell`. So the two rows cannot drift apart,
and adding the carousel to a third section is a `render` and three settings.

It is `row-`, not `fp-`. The prefix was `fp-` for featured-products while it
lived in that one section; a shared component naming itself after one of its
callers is how the next reader is misled.

**Grid is the default in both and is untouched** — Most Loved keeps
`.grid-auto grid-auto--products` and its 60ms per-card `.reveal` stagger, Our
Products keeps its plain `.grid-auto` at 80ms.

- **The cell is a grid of one** (`.row-carousel__cell { display: grid }`), so
  the card fills it the way it fills a column in the plain layout. Without that
  the cell stretches to the row and the card sizes to its own content, and a
  page whose titles wrap differently ends with ragged bottoms. `.card` escapes
  it by declaring `height: 100%`; `.cat-card` does not, and should not have to.
  Measured: three category cards level at 601px, each filling its cell.
- **The ruler's expression is `.grid-auto`'s, not the product grid's**, so it
  serves any row this wraps — `--min`, `--min-pct`, `--cols` and `--gap` are
  declared on `.grid-auto` and inherit into the ruler from whichever track it
  sits in. `--min-pct` defaults to `100%` there, which is what lets Our
  Products, which never sets it, measure correctly. Verified: its ruler
  resolves to its own 360px floor and the carousel reaches the same 3 columns
  the grid does at 1280px.

  The **660px single-column override is scoped to `.grid-auto--products`** on
  the ruler as well as on the grid. It is that grid's own threshold, not a rule
  about every row; a category row reaches one column on its own 360px floor.

The carousel is **not in the design**: its homepage lays Most Loved out as a
grid, and there is no slider anywhere in the 24 pages. Everything about *how*
this one moves is the design's, though, so it reads as the same maison rather
than as a plugin dropped in — `carousel_motion` picks which of the two motions
the theme already owns:

- **Slide** is the quick view gallery's — one track translated by whole pages,
  `transform 0.6s var(--ease)`.
- **Fade** is the hero carousel's — the window of cards is swapped in place
  and each one replays `gj-card` (rise and fade, 0.5s) 80ms apart. It is not a
  cross-fade: the two pages are never on screen together.

  **It hands the page over rather than cutting to it**, which is the bag
  drawer's mechanic doing the same job. The cards on show leave behind
  `gj-fade-out` (0.18s), the swap happens while nothing is showing, and the
  arriving page plays `gj-card`. The hero simply takes its outgoing pair away,
  and copying that here was wrong: the hero swaps two cards under a fixed
  heading, where a row of eight cards vanishing in one frame and rising back in
  reads as a flicker. Both card kinds fade — the rule reaches whatever the cell
  holds, a product card or a category one.

  `theme.js` waits through **`afterFade`**, the shared helper: set the attribute
  that plays the leaving animation, then call it with the duration the
  stylesheet gives that animation. It forces the style recalculation that makes
  the animation findable and falls back to that same duration. The drawer and
  the carousel are its two callers, and a third hand-over should use it rather
  than repeating the two mechanics — see "Two mechanics make it work" under the
  bag drawer, which is what it now holds.

  **A press during a fade is held, not dropped**, as the cart holds a quick
  second press: `target` is where the row is going and `page` is where it still
  is, they differ only mid-hand-over, and an arrow steps from `target`.
  Stepping from `page` would ask for the page already on its way and be thrown
  away as a no-op. Verified: pressing next then prev twice inside one 180ms
  fade lands on page 0 in a single hand-over.

The arrows are **bare and large**: a **28px glyph in full ink** turning
`--c-accent` on hover, centred in a **46px target that is never drawn**. They
are gone entirely when there is nothing to cycle through, which is
`.hero-carousel.is-static`'s rule. The page marks beside them are **hairlines,
not dots**: the brand marks a set with a rule.

The 46px and the ink-to-gold come from the design's own control for stepping a
row of pieces — "Find by shape" on its home page, a 1px ring at ink 16% round a
17px glyph. **The ring is dropped and the glyph grown in exchange, on request.**
With no ring the arrow *is* the control, so it has to carry the weight the ring
was carrying; 17px bare would read as less than the ringed 17px it replaced.
The box stays 46px square, so dropping the ring costs nothing in target size
and moves nothing in the layout — the columns beside the track are the width
they were.

The row carried the hero's arrow before either of those — a bare 20px glyph at
ink 60%. That is right on a dark full-bleed stage where nothing competes with
it, and at the foot of a porcelain row the width of the page it read as an
afterthought.

- **`carousel_arrows` puts the arrows under the track, over it, or either side
  of it**, and only that setting changes; the marks travel with them. Under is
  the default and is what the row shipped with.

  Beside the track they take **columns of their own rather than lying over the
  cards** — a card here is clickable to its edges, and the hero, the design's
  only row with arrows beside it, sets its own beside the cards too.

  **Below 38rem they come down and take their places either side of the
  marks**, which is what the hero does with its own arrows as the viewport
  narrows. A card on a phone is the whole row, and a flanking pair takes 112px
  off it: measured at 375px, a card of 227px against the 339px it keeps this
  way. Keeping them beside and shrinking them to 36px instead was tried, on
  request, and taken back out — 84px is still most of the same bite. 38rem is
  the width this block has inside the page gutters at the 660px viewport where
  a product grid drops to one column, asked of the carousel's own width rather
  than the screen's, so a row in a narrow column gets the same answer.

  **`.row-carousel__frame` exists to be laid out, because `.row-carousel` exists
  to be measured.** A container cannot be styled by a query against its own
  size, and what changes here is the arrangement, which lives on the container
  — the same reason `.promises` and `.footer__cols` are shaped this way.
  Putting `container-type` and `grid-template-areas` on the one element looks
  right, uploads clean, and simply never fires: it was written that way first
  and the narrow tier was dead until the frame went in. Only a rule that
  applies to a *descendant* — an arrow's own size, say — can skip the wrapper.

  **Every gap here is a margin on the element, never the grid's own `gap`.**
  The side columns are `auto`, so a hidden arrow collapses its column to
  nothing — but a `column-gap` belongs to the grid and would stay, leaving the
  track 20px short on a single-page row. Naming the areas likewise declares the
  marks' row whether or not anything is in it, so a `row-gap` would leave a
  band of dead space under a row with its controls hidden. Verified: 0px below
  the track, and the track full width, on a single-page row.

  Beside the track the arrows and the marks are **three separate visibility
  units** — nothing wraps them — so `data-row-controls` goes on each and the
  script hides every one it finds. Under or over the track that attribute is on
  the one control row, as before.
- **The marks are a carousel of their own: a strip that travels, not a row that
  wraps.** A page is one card on a phone, so sixteen pieces is sixteen marks —
  more than fits beside the arrows. Wrapping was the old answer and it turned
  the control row into a paragraph of rules, pushing the arrows further from
  the track with every extra page. Now `.row-carousel__dots` is a window that
  clips and the strip inside it shifts to keep the current mark near the
  middle; what is off either end half-shows past the edge, which is how the row
  says there are pages before or after the ones in view.

  `width: fit-content` is what keeps a short set centred — the window shrinks
  to the marks when they fit, so the group still hugs the middle of the row,
  and only caps at the width it is given when they do not. `flex: 0 0 auto` on
  the mark stops the strip solving its overflow by squeezing every mark
  instead.

  **The shift is arithmetic on the resting geometry, not a measurement.** The
  current mark is 12px wider than the rest and is still growing into that when
  the page changes, so a rect read at that moment is mid-transition and lands
  the strip a few pixels out. `--row-mark`, `--row-mark-on` and `--row-mark-gap`
  are declared on `.row-carousel__dots` and read back by `theme.js` — the ruler's
  arrangement, where the stylesheet stays the one place a measurement is
  stated. Verified against a 100px window over 7 pages: 0, 0, 27, 57, 87, 114,
  114, with the current mark whole and centred throughout and flush at each end.

  The travel borrows the mark's own `var(--duration)`, not the track's 0.6s, so
  a mark widening and the strip sliding under it are one movement.

- **The track is the same element in both layouts**, and without scripting
  that is all it is: the plain grid, every card in it, every link real. The
  controls are rendered `hidden` and the script unhides them only once there
  is more than one page. `data-row-live` is what hands the track over.
- **How many cards fit is `.grid-auto`'s question and is not answered twice.**
  `.row-carousel__ruler` is one hidden, out-of-flow box carrying the grid's own
  width expression; `theme.js` divides the track's width by whatever the
  browser resolved it to. Every threshold therefore stays in the stylesheet
  beside the grid's own — **including the single-column override**, which is a
  media query on the ruler, scoped to the product grid as the grid's own is. Re-deriving `auto-fit`'s rule in
  JavaScript is how the two layouts would quietly stop agreeing about a column
  count. Verified against the grid at 1190px (3 columns each) and at 375px
  (1 column each).
- **The row is bounded, not looping.** The hero wraps, but the hero has a
  window of two and no position indicator; here the marks state where you are,
  so an end is an end and the arrow disables. Wrapping would also mean sliding
  the whole row back in 0.6s — fifteen page-widths at one card per page.
- **A swipe over a card's photographs belongs to the card.** It steps through
  the piece's own images, so the carousel makes the same geometric test the
  card makes (`.card__media`'s box, and only where the piece has more than one
  slide) and leaves that gesture alone. Both listening is one gesture answered
  twice.
- **Slide keeps the whole row in the document, so off-page cards are marked
  `inert`.** Not tidiness: focusing a card that is translated off screen makes
  the browser scroll the clipped viewport, which leaves the track showing
  something other than the page it is on. The viewport is `overflow-x: clip`
  (not `hidden`) for the reason given under "Things that cost time once" — it
  refuses the overflow without becoming a scroll container.
- `--row-per` must hold a number **before** `data-row-live` goes on, or
  `grid-auto-columns` is invalid at computed-value time and the row collapses
  to one column. The measurement is therefore taken while the track is still
  the plain grid, and only then is it handed over.
- The carousel reveals as a **whole** (`.reveal` on the component) rather than
  card by card, and the cards' entrance is `gj-card`. Two entrances on the one
  element — a `.reveal` transition and a `gj-card` animation both driving
  opacity and transform — is what that avoids, which is why
  `.js .row-carousel.reveal` puts the block back to opacity 1 with no
  transition: `.reveal` is there to *time* the entrance, not to play one.
- **`gj-card` is held `animation-play-state: paused` until `is-visible`.**
  `data-row-live` goes on at `DOMContentLoaded`, so without this the whole
  entrance — 500ms plus `(--row-per - 1) × 80ms` of stagger — is spent while the
  block is still at opacity 0 below the fold, and the row a visitor scrolls
  down to has already finished animating. It shipped that way and the carousel
  simply appeared, where the grid staggers on scroll-in.

  `both` fill is what makes a paused animation double as the waiting state:
  the cards hold at the keyframe's start rather than needing a second rule to
  hide them. Reduced motion drops the animation outright rather than shortening
  it, so a paused card can never be left at opacity 0.
- **`.display + .row-carousel` must be in the heading-gap rule beside
  `.display + .grid-auto`.** The carousel wraps the row, which breaks that
  adjacency — so a Most Loved with its subheading cleared and "view all" off
  had its cards flush against the title, in carousel mode *and* on the no-JS
  path where the output is a plain grid anyway. Any future wrapper around a
  section's grid needs the same line. See "A `.display` heading has no bottom
  gap of its own" below.
- **The viewport carries no `touch-action`, deliberately.**
  `.hero-carousel__window` has `pan-y` and copying it looked right; it would
  cost the visitor pinch *and* double-tap zoom across the whole row and buy
  nothing, since both touch listeners are passive and `clip` means the element
  is not a scroll container. Any non-`auto` value withdraws zoom — `pan-y
  pinch-zoom` is not the fix, `auto` is.
- **An arrow that disables itself takes focus with it.** Reaching the last page
  disables the control that was just pressed, and a disabled button drops focus
  to `<body>` — so a keyboard visitor is thrown back to the top of the tab
  order. `paint()` notes what had focus and moves it to the arrow that still
  works. Six cards at three across is enough to hit it on the first press.

### Hero

A 1:1 rebuild. Three art-directed arrangements at 990px and 1100px (see
"Fluid for continuous values" above), the wordmark letters rising 60ms apart
from `.1s`, and the design's decorative arcs rendered through the centralized
Liquid icon library. The former sparkle layer, setting, Icon block option, and
SVG snippet are removed.

**A Collection tab's Product image shape and Product image fit belong to its
carousel.** The active product pool carries both values into its card frames;
switching tabs therefore changes the selected collection and the presentation
of that collection's product images together. The Hero portrait is owned only
by the section-level Portrait image setting. Collection tabs have no image
uploader and cannot replace or resize the Hero portrait. Product image fit has
four useful, non-distorting modes: Fill the frame (`cover`), Fit the whole piece
(`contain`), Scale down only (`scale-down`), and Original size (`none`). Do not
offer CSS `fill` here because stretching product photography changes the piece's
proportions.

**The hero fits itself to the screen rather than clipping.** It is a
screenful, and its content does not always agree — at 1280×560 the grid
overflowed by 118px and took the "Collections" button with it. `fitHero()`
scales the whole grid down (CSS `zoom`, binary search between 1 and a 0.7
floor, eight passes), and if even the floor will not fit it releases the
section to `height: auto` so the page scrolls instead. A hero past the fold
beats one with its button cut off. Three regimes, all verified: unscaled at
1280×900, 0.7 at 1280×560, released at 1280×300.

It re-fits on resize, on `document.fonts.ready` (the bundled faces land after
first paint and change every measurement), when the carousel swaps pair —
and from a **ResizeObserver** on both boxes. The observer is not redundant:
a window listener never notices content changing on its own, and it is what
lets a scaled-down hero scale back *up* once there is room again.

**Watch the thresholds — there are three, not two.** The grid arrangement
changes at 990px and 1100px, but the carousel cards step up at **1000px**,
on their own media query. Between 1000 and 1100 the design runs the medium
two-column arrangement with the larger cards, and folding that into the
1100px tier is wrong.

The **piece carousel** shows two at a time out of one collection per Collection
tab. Each `collection_tab` block carries its own label, collection, product
image shape, and product image fit. Its editor is deliberately narrow: Content
contains the label and collection; Carousel media contains only shape and fit,
with no image uploader. The shape choices use the same square, portrait, tall
portrait, landscape, and wide vocabulary as Lookbook media. The whole pool is
rendered and the carousel picks the visible pair, so stepping never
waits on a request and every piece is a real link without scripting — a
visitor without it simply sees the first pair. Arrows hide themselves when
the pool is too short to cycle.

The hero wordmark carries `data-nav-anchor`, which is what the nav measures
its pill → bar expansion against.

### Navigation

- The nav is **one element in two states**, not two elements. `.nav--pill`
  transitions width, height, offset, radius and padding into the centred pill.

  **This is a deliberate departure from the design, not a port of it.** The zip
  has *two* `<nav>` elements — `data-gj-nav="pill"` and `data-gj-nav="bar"` —
  behind `sc-if isPill` / `sc-if isBar`. Crossing the threshold unmounts one
  and mounts the other, and the new one plays `gjNavPillIn` / `gjNavBarIn`
  (`opacity 0→1` plus a 12px drop, `.8s cubic-bezier(.22,1,.36,1) .1s both`).
  **The design never interpolates the width.** Its long
  `width/max-width/top/border-radius/padding/height .5s` transition list is
  real CSS in the zip but cannot fire for the pill → bar change — the pill's
  inline geometry is literal constants, so nothing ever changes them; it only
  serves the pill's own background/border-colour changes and viewport-driven
  `max-width`. Checked against zips 1, 5, 9, 11 and 12: it has always been a
  swap. The two entry keyframes are **not ported**.

  The durations, easing and every geometric value here *are* the design's. The
  technique is not, and the two notes below are the price of that: animating
  layout properties means nothing runs on the compositor, and both of those
  defects were consequences of the sweep rather than of any wrong number.
- **The morph runs pill → bar, not bar → pill.** In the design the homepage
  opens with the floating pill over the hero and it *expands* into the
  full-width bar once the hero title has scrolled past. Getting this backwards
  is the single easiest mistake here; it was shipped backwards once already.
  The threshold is the bottom of `[data-nav-anchor]` (the hero wordmark) minus
  80px, exactly as the design measures it; the px setting is only the fallback
  for pages with no such anchor.
- **The nav is centred in both states and only `width` animates.** This is the
  whole trick and it is easy to undo by accident. If the bar were
  `left: 0; right: 0` and the pill `left: 50%; transform: translateX(-50%)`,
  flipping the class would move three properties that are not in the
  transition list — and `right: auto` cannot be interpolated at any rate — so
  the nav would snap to the left edge in one frame and only then stretch.
  Hold `left`, `right` and `transform` constant; let `width` do the work.
- For the same reason the pill's cap lives in `width: min(16.5rem, 94vw)`
  rather than a separate `max-width`. Two animated lengths fighting each other
  is what once left the pill collapsed to 18px — its padding and border with
  the content width contained away to zero, because `container-type:
  inline-size` means a stalled `max-width` starves the box rather than
  falling back to its contents.
- The wordmark **cannot be `display: none` in the pill** — that cannot animate,
  so the letters would pop rather than cross over with the width. It is taken
  out of flow and faded on the design's asymmetric timings: out over 0.07s
  linear as the bar collapses, in over 0.45s ease as it opens.
- `.nav__menu-label` and `.nav__action--account` drop out on **media** queries,
  not container queries: the design keeps "Menu" beside the rules even in the
  264px pill, so asking the container would wrongly strip it there.
- **The corner radius is `calc(var(--nav-pill-h) / 2)`, never the design's
  `999px`.** 999px is a sentinel — the browser caps a radius at half the
  shorter side, so it paints 26px on a 52px pill either way. But interpolating
  `0 → 999px` crosses that cap **3.3% of the way in**, so 96.7% of the radius
  animation happens past the point where it changes anything. Measured: square
  corners at 1265px wide at 0ms, a fully round 1229px stadium at 4ms — one
  frame. The corners snapped rather than morphed, while the bar was still
  nearly full width. Deriving the radius from the height puts the whole range
  on screen: it reaches stadium exactly as the width lands. **Any animated
  `border-radius` in this theme needs the same treatment** — check where the
  cap falls before writing a round number.
- **The resting state is emitted by Liquid, not added by JavaScript**, so the
  first paint is already correct and a nav that never changes needs no script.
  Only `morph` attaches a scroll listener.
- A section group is shared by every template, so the design's per-page nav is
  **two settings**: `nav_mode_home` (default `morph`) and `nav_mode` for
  everywhere else (default `bar`). The design's own values: home `morph`,
  inner pages `bar`, product page transparent-until-scrolled.
- **The product page's transparent-until-scrolled nav is the design's own,
  built from parts that already existed** — `nav_product_transparent`, a
  checkbox beside the mode selects, off by default and on in this store. It
  sets `overlay` (no spacer, so the gallery starts at the very top under the
  bar) and withholds the resting `is-solid`; the existing
  `.nav--overlay:not(.is-solid):not(.nav--pill)` rule paints the transparent
  state, and `initNav` toggles `is-solid` past the same threshold the morph
  uses — on a product page there is no `[data-nav-anchor]`, so the
  `scroll_threshold` setting is the cue. The base nav already transitions
  `background-color`/`border-color` at 0.4s, so the solid ground fades in
  and out with the scroll for free. **A fully hidden header was built first
  and taken out on request** — the bar's links stay visible over the
  gallery; do not reintroduce a `.nav--veiled` state.
- **The bar is one scheme everywhere, and the transparent rest borrows the
  page.** `nav_scheme_product` existed for one commit and was removed on
  request — the solid bar a visitor sees on scroll is the same bar on every
  template. The transparent state is not a scheme of its own:
  `[data-nav-transparent]:not(.is-solid)` takes the page's `--c-ink` and
  `--c-gold` brand tokens, so the links stand readable over the light
  gallery and the scroll hands over to the ordinary global bar.
- The nav is its own **query container**, which is what gives the pill the
  compact treatment at 264px without pill-specific overrides. That is free at
  the two resting states and **expensive in between**: the morph sweeps the
  nav's width across the 62.5rem threshold, so the query re-evaluates every
  frame and flips `display` on three elements *mid-transition* — measured at
  33ms into a 500ms shrink, two frames after it starts. Both ends of the nav
  visibly jumped while it was still moving.

  So the expanded rules are scoped `.nav:not(.nav--pill)`. A pill is compact
  whatever its container says, and saying so explicitly moves that swap onto
  the class flip at 0ms — one deliberate change as the morph begins, which is
  what the design does when it swaps its two nav elements outright. **The
  exclusion is load-bearing, not redundant.**
- Menu rows are **section blocks, not a Shopify linklist**, so the design's
  content ships working without the merchant first building navigation menus.
  Numbering is generated from block order; Bag and Search are appended last.
- **The two shells treat a branch differently, on request.** The overlay
  drills: every level of the merchant's menu renders as its own hidden panel
  inside `[data-nav-levels]`; choosing a parent swaps the whole menu for
  that branch's list — Back row on the title column, the parent's name as a
  micro heading, rows numbered from 01 with "View all" first — and Back
  walks each level's stated `data-nav-level-parent`. The leaving level fades
  through `afterFade` and the arriving rows re-run the row cascade on their
  own, because hidden-to-shown restarts animations. A drill row is a **real
  link to its own page**: `initNavDrill` (and the module-scope capture
  claim, which must list `[data-nav-drill]` or the ring-builder app steals
  the click) intercepts only when the target level exists. **The drawer
  folds instead**: a parent row is the footer's disclosure — plus/minus
  mark, three-layer 0fr/1fr panel, `initNavBranches`' one-at-a-time rule —
  because a panel column reads naturally as an accordion, and its no-script
  state is every panel open. Each shell's markup contains only its own
  controls, so both controllers bind unconditionally; on overlay close the
  levels re-root and the branches fold, whichever rendered. A menu-row
  focus state is its colour, never the global outline box.
- **The menu has two presentations, chosen in the Header section's Menu
  group** — `menu_type` and the drawer's colour scheme moved there from the
  global Navigation group (since removed) so everything the header does is
  set in one place: the design's full-screen noir overlay
  (the default), or the cart drawer's shell sliding **from the start edge** —
  mirrored left where cart and search come from the right, so the two kinds
  of drawer never stack on one edge. One capture in `nav-menu.liquid` holds
  the rows, categories, and foot; the shells cannot drift. The drawer panel
  redefines `--c-ivory: var(--c-text)` — the search drawer's single-property
  palette hand-over — so the noir overlay rules follow the merchant's chosen
  scheme, and it declares its own `--menu-step`/`--menu-lead` so the row
  cascade runs on a panel's clock. Only `animation-name` changes for the
  slide (`gj-drawer-in-start`/`-out-start`), keeping the drawer's own
  duration, curve, and fill; that closing rule ties the base drawer's at
  three classes, so the menu-drawer block must stay *below* the drawer core
  in `base.css` — source order is what decides it.

### Footer

- Three tiers, fixed rather than auto-fitting: **4 columns**, **2 columns**,
  then the **accordion**. Container queries on `.footer__cols` at 63.25rem and
  36.86rem — the design's 1100px and 640px viewports converted to the width
  the block gets inside the page gutters. `.footer__grid` inside it is what
  gets re-columned; the wrapper exists to be the container.
- **One set of markup serves columns and accordion.** The container query
  turns the column heading into a real toggle rather than duplicating every
  link into a separate mobile block, which is what the design does.
- The dividers go on the **bottom** of each row and the last one is dropped:
  the wordmark's rule above and the block's own rule below already close the
  set, so border-top would double against the wordmark's.
- The salon column is the only one whose entries wrap, so it is the only one
  with looser leading (`.footer__col--salon`).

### Product card

A 1:1 rebuild of `Product Card.dc.html`, now composed through
`blocks/_product-card.liquid` on Featured products, collection, and search.
The old `snippets/product-card.liquid` remains only on the design-system page.

- **Product facts are contextual forms of the shared content blocks.** Product
  title and Vendor render through `text-block`; Description renders through
  `rich-text-block`. They can be added directly to Product card or its private
  Group, keep the same settings they have on Product page, Featured product,
  and Quick view, and always read the card's current `closest.product`. The
  Product card title preset starts as a linked `h3` with balanced wrapping,
  while the ordinary Product title preset remains the product-page `h1`.
  Cards reserve two rows for visual alignment but expand for longer names;
  Product title never offers a clamp or ellipsis, and the renderer ignores
  retired truncation values saved by an older theme version.
- **Option values is contextual Text, not a second typography system.** It
  locks the content to a merchant-named product option and adds only a
  separator. All layout, semantic element, typography, alignment, wrap/line
  count and spacing settings come from Text. The interactive Option control
  remains a separate private behavior block because it also synchronizes the
  selected variant, price and add action.
- **Line break is a Spacer preset.** It is zero-height and enables `Start a new
  row`, which makes Spacer claim a full row inside a horizontal Group so the
  following children wrap cleanly. The normal Spacer preset remains responsive
  whitespace and can enable the same row-breaking behavior when a gap is also
  wanted. Both are valid inside Product card and its private Group; no extra
  one-purpose global block type is introduced.

- **The design's card is one `<a>` with buttons nested inside it**, which is
  neither valid HTML nor navigable. Here the private card shell emits one
  empty, accessible structural link whose box covers the card, so navigation
  does not disappear when a merchant removes or rearranges Product title. The
  media and caption open the piece while controls sit above that layer.
  **Anything inside the card that must stay clickable needs a `z-index` of its
  own** — the add button included, because a static element paints *below* a
  positioned one whatever the document order.

  It also moves the events. A touch over the photograph targets the *link*,
  not `.card__media`, so the swipe listener is bound to the card and checks
  where the touch landed. Binding it to the media looks right and never fires.
- **Hovering previews the next photograph** — not "swap to the second image".
  Once the arrows are used the card is off automatic until the pointer leaves
  and comes back, exactly as the design has it. The stylesheet runs the
  two-photograph case on its own for a visitor without scripting; the script
  marks the card `data-card-live`, which is what takes those rules out of the
  way.
- **Every photograph is a slide, and nothing is capped.** One or a hundred:
  the count is whatever `product.media` holds. The old `card_media_count`
  setting (range 1–4, default 2) is **gone** — it was silently dropping 1–3
  photographs per card on this catalogue, where pieces carry 3–5.

  **Only the first two slides are fetched, whatever the count.** Slide 0 is
  what shows and slide 1 is what hover previews, so those two are the whole of
  it without scripting — the arrows do nothing without JS. Everything after
  them is emitted with `data-src`/`data-srcset` and **no `src`**, and
  `snippets/card-slide.liquid` is where that lives. `load()` in `initCards`
  promotes the current slide and both its neighbours, so stepping never waits
  and a card is never more than three photographs of traffic.

  This is not optional cleverness. A slide is `opacity: 0`, **not
  `display: none`** — the browser counts it as visible and fetches it with the
  rest of the card however far down the stack it sits. Uncapping without
  deferring would have been 100 requests per card times every card in the
  grid. Measured on `/collections/all`: 24 cards, 79 `<img>` tags, **48 with a
  real `src`** — two per card, exactly what it was at a cap of 2.
- **The slide order is the product's own, and the metal control must not touch
  it.** The design is explicit: *"Colour is chosen on the card itself: the
  name, the price and what goes in the bag all follow it. The photograph does
  not — we shoot one metal."*

  A pass once led the order with `selected_or_first_available_variant.
  featured_media`. It was inert — **no variant in the shop carries media**
  (checked across all 89 products: every `variant_ids` empty, every
  `featured_image` null) — but aimed the wrong way: assigning variant media in
  admin would have started the opening photograph following the metal, the one
  thing the design rules out. It was removed rather than left dormant. The
  metal in a filename (`…-White-Gold-Pair.webp`) is the only metal signal the
  media carries and **nothing should parse filenames.**
- **The metal swatches are revision 13's, and the option beats the metafield.**
  A row of metals on the card; picking one moves the caption, the price and
  what goes in the bag. `snippets/metal-swatch.liquid` is the single place the
  theme decides what a metal looks like, shared with the product page.

  **The paint comes from the option value's own swatch and from nowhere else.**
  In admin the Metal option is connected to Shopify's Color metafield, so each
  value carries its own swatch — measured on this shop, Yellow Gold and White
  Gold resolve to swatch *images* (`swatch.color` is empty), while Gold Karat
  and Wrist Length correctly carry none.

  **Never hardcode it.** An earlier pass matched the value text against a table
  of eight metals and painted from bundled gradients and `assets/metal-*.webp`.
  That duplicated data the merchant already maintains, went stale the moment a
  metal was added or renamed, and quietly painted the wrong colour for anything
  it failed to recognise. Adding a metal is admin work now, not a theme change.
  The `assets/metal-*.webp` files are consequently unreferenced — the same
  images are uploaded into the metafield and served from `/cdn/shop/files/`.

  A value with no swatch configured paints nothing and keeps its hairline and
  its accessible name, so the metal stays pickable and announced. This is
  visible today: of 12 products on `/collections/all`, 4 have the option
  connected and paint, 8 do not and show bare dots. That is the connection
  missing in admin, not a theme fault.

  **The card shows the row anyway, and a bare dot is the right answer.** A pass
  once gated the row on whether anything painted (`metal_paints`) and replaced
  it with "Available in: 2 Metal" where nothing did. That was reverted on
  request: it swapped a working control for a sentence on two thirds of the
  catalogue, and the row is a *control* — the dots are still pickable, still
  named, and still move the caption, the price and what goes in the bag. Do not
  reintroduce the fallback; connect the Color metafield in admin instead.

  **`custom.metal` no longer wins where a control exists.** Every product in
  this catalogue sets it, so letting it win froze the caption on all 89 cards:
  choose White Gold and it still read "18 Karat Yellow Gold". That is a wrong
  answer, not a preference. With a control the caption is built from the
  option; without one the metafield still wins and the caption is marked
  `data-card-meta-fixed` so the script leaves it alone.

  **The caption is the metal and the carat weight — `White Gold · 1.0 ct` —
  with no karat prefix.** It read `22K White Gold · 1.0 ct` once, which stated
  the karat twice: the note directly below already lists every karat the piece
  comes in, and the card cannot choose one anyway. Nothing in the card looks up
  the purity option any more; the lookup was removed rather than left unused so
  it cannot creep back into the caption.

  The order in the card body is title → caption → swatches → karat note →
  price. The caption sits **above** the swatches and the karat note **below**
  them; that split is deliberate and was confirmed.

  Each swatch is a **real link** to `?variant=…`, so a pick works without
  scripting — it simply navigates — and every metal's caption and price markup
  is rendered onto the link by Liquid, so a pick costs no request and no
  arithmetic. They need a `z-index` of their own, like everything clickable in
  a card. (The design uses a `<button>`; a button without script does nothing,
  and the theme's rule is that nothing is load-bearing without scripting.)

  Four details of it are exact to the design and each was wrong first time:

  - **Order is the design's metal table, not the option's.** `metals()` ends
    `return ORDER.filter(…)` — white, yellow, rose, mixed, platinum, palladium,
    sterling, fine silver. Shopify's order is whatever the merchant typed,
    which had cards opening on Yellow Gold with White Gold second. Values
    matching no metal are appended rather than dropped.

    It lives in **`snippets/metal-order.liquid`**, because the quick view's
    swatch row orders itself the same way and the table is the design's rather
    than either component's. A snippet cannot hand a value back, so it *prints*
    the values joined with `||` and callers `capture` then `strip | split`.
  - **The selected ring is `--c-surface`, not `--c-bg`.** The design uses a
    surface gap inside an ink ring, so the gap belongs to the *card's* colour;
    on the page background it reads as a porcelain halo. It is two shadows and
    not a border because a border would consume the dot's width and shift every
    swatch beside it.
  - **`.swatch-dot` fills its control by default** (`width: 100%`), because
    `--card-swatch-*` is scoped to `.card` and the product page's 56px button
    uses the same dot — outside a card those properties are undefined, so the
    sizing would be invalid at computed-value time and the dot would collapse.
    The card's 20px comes from `.card__swatch .swatch-dot`. Its hairline colour
    carries a fallback for the same reason, or it would resolve to
    `currentColor` and draw a hard ink ring.
  - **Three at most before a width is known** (`n = Math.min(keys.length, 3)`),
    and the row **hides entirely when fewer than two fit** — `hasSwatches:
    swatches.length > 1`, because a row offering one metal is not a choice.

  Watch the drop: `ordered_metals` comes back through `split`, so its entries
  are plain strings, not `product_option_value` drops. The drop is what carries
  a merchant's native swatch, so it is looked up again before the render — with-
  out that the snippet's most specific branch is silently unreachable.

  Six traps found by review, each of which had shipped:

  - **The row is `capture`d and then conditionally printed, not conditionally
    built.** The swatch loop is also where the price works out the selected
    metal's figure, so gating the *loop* on `card_show_swatches` left
    `selected_price_html` unassigned while the price element still read it —
    turning swatches off emptied the price on every product with a metal
    option. The setting decides whether the row is printed, nothing else.
  - **The needle pass must test membership before appending.** A value naming
    two metals — "White & Rose Gold", or the design's own Mixed Metal — matches
    more than one needle, and without the test it is appended once per match:
    two swatches for one metal, both selected, an inflated "+N", and a real
    metal pushed past the third slot and hidden. `break` only on an append, so
    a needle whose match was already placed keeps looking.
  - **The card does not pass `selected` to the dot.** The wrapping link carries
    the state and `.card__swatch.is-selected .swatch-dot` draws from it. Marking
    the dot too left two rings after a pick: the script moves the class on the
    link and never on the dot. The parameter stays for the product page, which
    uses the dot without a wrapper.
  - **`.swatch-dot` needs `background-origin: border-box`.** `cover` sizes the
    image to the *origin* box while the clip paints it across the *border* box,
    so with the initial `padding-box` the border ring is left unpainted. That is
    invisible while the border carries a colour — and a **white hairline around
    every selected dot** the moment `is-selected` sets `border-color:
    transparent`, because the card shows through. Checked the image first: the
    swatch webp is full-bleed gradient to all four edges at alpha 255, so it was
    the ring, not the artwork.
  - **The focus ring goes on the dot, not the link.** The row clips
    (`overflow: hidden`) and the link fills its 44px exactly, so an outline on
    the link is drawn outside the box and cut off. 20px + 2px offset + 2px
    stroke is 28px, well inside the target.
  - **`background:` is a shorthand and resets sizing.** `--metal-swatch` may be
    a `url()` — a native swatch image, or the `metal-*.webp` the product page
    paints with — and those are 80px, so without `background-size: cover` after
    the shorthand a 20px dot shows a crop of one corner.
  - **Modifier clicks must pass through.** A swatch is a real link, so
    ctrl/cmd/shift/alt-click and middle-click have to reach the browser;
    `preventDefault` on those swallowed a navigation the visitor asked for.

  A pick also moves the **quick-view href** and, when the new metal is sold
  out, **disables Add to Bag and swaps its label** — both labels ride on the
  card as data attributes so no translation string lives in JavaScript.
- **The note is the karat sentence and nothing else**: `Available in 18K, 22K`
  (`products.available_in`). Size stays out, as it always has — the design's
  note was three axes joined with `·`, and listing every option instead put the
  ring sizes on the card.

  **Every value is listed whatever the stock.** An option value exists because
  the piece can be made that way, so a sold-out karat is still a karat the shop
  offers; filtering on `available` would make the sentence flicker as inventory
  moved.

  **Sorted smallest karat first, numerically.** A plain string sort puts "22K"
  before "9K", so the number is pulled out of each value and zero-padded into a
  sortable key which is then discarded. A value with no number in it sorts to
  the front rather than vanishing.

  **The card adds the dearest variant, and prices what it adds.** Karat and
  size are not selectable here, so adding has to choose: the dearest *available*
  variant in the chosen metal, on request. Available first, because a sold-out
  variant cannot be bought — where a whole metal is sold out the dearest overall
  stands in and the button says Sold out.

  The price shown is that same variant's. It used to read "From <cheapest>"
  whenever the metal's variants differed, which was fine while the button posted
  a cheap one and became a **trap** the moment it posted the dearest: one figure
  on the card, another in the bag. The range is said in words underneath
  instead, which is what the note is for. `price_varies` is gone from the card
  either way — it is true the moment any two variants differ, including two ring
  sizes.

  Verified against real data: Yellow Gold 5899 / 5949 / 6783.85 / **6833.85**
  → the card shows $6,833.85 and posts the `22K / 18 in` variant.

  How many swatches fit is measured, not queried — it depends on the card's own
  width, and in a two-column phone grid the card is about 159px. One
  `ResizeObserver` serves every row on the page rather than one apiece; without
  it the row simply clips.
- **No-script cards keep the opening photograph.** Every later photograph is
  deferred without `src`/`srcset`, so only `theme.js` may reveal one: it first
  promotes that requested source and then changes the active slide. A CSS-only
  hover swap would expose an empty slide and is intentionally not provided.
  Arrows and swipe remain progressive enhancements; the card-wide product link
  remains the complete no-script path.
- **The spin counts only once an mp4 rendition is known to exist.** The slide
  is guarded on `sources | where: 'format', 'mp4'` and the count was not, so a
  video without one shipped arrows and a badge for a slide that never
  rendered. Resolve the rendition before incrementing.
- **The caption type is fixed, not fluid.** 14.5 / 12 / 15 / 12px at every
  width, because the column is capped near 305px and the design states them as
  literals. Both caption lines keep their row whether or not there is a word
  in them, which is what holds a row of cards level; the title is split into
  two balanced lines in Liquid, by the design's own rule (minimise the
  difference in length, ties to the later split).

  Those four numbers are **`--product-*` properties at `:root`, not `--card-*`
  at the top of the block** — the card's layout properties still are, but its
  *type* is shared. See "Product text" below. Everything else in the card
  block stays literal and card-scoped: do not "fix" those into tokens.
- **`--card-zoom` is the design's framing correction**, not decoration: its
  photographs are shot on white with margins that differ by category, so a
  bracelet is scaled 1.05 and a pair of earrings 1.39 for the piece to fill
  the frame. Matched on type then title, **earrings before rings** because
  "earrings" contains "ring". A `custom.card_zoom` metafield overrides it per
  piece; `card_image_zoom` turns it off.
- **The shipped default is Square, on request, not the design's 3/4.** A
  deliberate departure: `card_image_ratio` defaults to `1/1` and
  `card_image_fit` to `contain` ("Fit the whole piece"). The design's frame is
  3/4, which on this catalogue's 3:2 photographs leaves 74–104px of blank above
  and below the piece — see the note below. Square halves that band while
  keeping the design's uncropped treatment.
- **Every value of `card_image_ratio` has to do its thing, `adapt` included.**
  It did not: `adapt` fell through to the same `3 / 4` box, so choosing it
  changed nothing at all. It now takes the shape from the first photograph the
  card shows; a card with no photograph keeps 3/4, there being nothing to adapt
  to.

  Worth knowing what the default means on this catalogue. Every photograph here
  is **3:2 landscape** (2560×1707) — the same shape the design's own 1240×827
  are — so in the design's 3/4 frame at `object-fit: contain` the piece fills
  only **58–70% of the height**: 74–104px of the card's surface shows above and
  below it, while the zoom crops 27–71px off each side. That is the design's own
  arrangement rather than a fault in the port, and `adapt` is the setting that
  closes the band. Measure before "fixing" the frame.
- LQIP state is added **by the script**, and only while a non-cached full image
  is outstanding. Putting the loading class in Liquid or the base stylesheet
  would leave a visitor without scripting looking at a photograph that never
  clears. A new image without `data-image-lqip` is incomplete work unless it is
  a logo carrying the explicit `off` value.

### Quick view

Quick view is a separate overlay shell, not a separate product implementation.

- `sections/quick-view.liquid` is saved in `header-group.json`. It owns
  only enablement, colour scheme, scroll mode, Product block order, and the
  shell-only “View full details” link.
- Its static `_product-media-gallery` and ordered `product_*` blocks are the
  same block files used by Main product and Featured product. Variant options,
  quantity, price, inventory, badges, accelerated checkout, and media therefore
  have one renderer and one behavior contract across all three surfaces.
- The section emits fetched product markup inside an inert
  `<template data-quick-view-inner>`. The always-present shell is
  `snippets/quick-view.liquid`; there is no quick-view-contents renderer.
- `theme.js` fetches the saved section id against the product URL, caches the
  response per URL, injects the template contents, and calls
  `window.VeylinProducts.init` on the injected root. Product behavior stays in
  `main-product.js`; quick view JavaScript owns only fetch/open/close.
- The trigger remains a real product link. If the section is disabled, absent,
  or cannot be fetched, navigation still reaches the product page.
- `panel`, `media`, and `details` scrolling are mutually exclusive shell
  choices. Their CSS may position the shared `.product-gallery` or scroll the
  shared details column, but must never introduce `.quick-view__pill`, a
  second variant resolver, or a second gallery implementation.
- The loading state is a transparent carrier for the shared loader; the actual
  modal entrance begins after its product markup arrives. Keep the close action
  focusable throughout loading. The carrier retains the Quick View's selected
  scheme: the full-screen mark uses that scheme's Loader on veil role, while
  the close control uses the carrier scheme's text, surface, and universal
  close style. Never replace those with literal brand colors merely because
  the carrier sits over a veil.

The acceptance test is behavioral parity: select the same option in Main
product, Featured product, and Quick view and confirm the selected value, hidden
variant id, price, availability, add button, dynamic checkout visibility, and
full-details URL all describe that same variant.

### Scrollbars

A 1:1 port of the design's `gj-scrollbar.css`, at the top of `base.css` under
"Scrollbars". All **24** design pages link that file, so it is a site-wide
theme rather than a component's.

- **Scrollbar colours are per scheme.** Each scheme owns its resting and hover
  thumb roles, so the page, Quick View, and drawers follow the scheme they
  actually display. The values compile to `--scrollbar-thumb` and
  `--scrollbar-thumb-hover`; CSS never carries a fallback colour.
- **The two halves are not equals.** The design puts the standard
  `scrollbar-width`/`scrollbar-color` on `*`, and where an engine honours those
  it may ignore the `::-webkit-scrollbar` rules and take the 11px width, the 3px
  inset, the pill radius and the scheme's hover role with them. The resting
  role paints everywhere; refinements paint only where the pseudo-elements are
  honoured. That asymmetry is the design's own and is kept. Measured in Blink
  here: both halves apply, and **`var()` does resolve inside
  `::-webkit-scrollbar`**, so the tokens need no literal fallbacks.
- **`scrollbar-gutter` is deliberately absent.** `theme.js` measures
  `window.innerWidth - html.clientWidth` *before* it sets `overflow: hidden` and
  applies the difference as body padding; a stable gutter would keep that
  measurement non-zero and stack a second gutter's worth of padding on every
  overlay open. `thin` alone is safe — the measurement is live.
- **The design hides some rails, and those must be hidden here too.** It marks
  them `data-rail`, with
  `[data-rail]{scrollbar-width:none}[data-rail]::-webkit-scrollbar{display:none}`.
  All four are ported: `.lookbook__rail`, which already had it;
  **`.search-overlay__results`, which did not** — its box was ported declaration
  for declaration and the hiding was not, which only became visible once the
  bars were themed; and the filter chip rail on All Products and Search, which
  is one component here — `.catalog-controls__rail` in
  `snippets/catalog-controls.liquid` serves both templates, and it carries the
  same `scrollbar-width: none` / `::-webkit-scrollbar { display: none }` pair
  on the class. An audit found only those two `overflow-x: auto` rails in the
  whole stylesheet, so nothing else scrolls a bar the design would hide.
- Both hidden rails win on their own: `scrollbar-width: none` at (0,1,0) beats
  `*` at (0,0,0), and `.x::-webkit-scrollbar{display:none}` at (0,1,1) beats
  `::-webkit-scrollbar` at (0,0,1) — and the universal rule declares no
  `display`, so there is no contest for that property at all. Verified by
  injecting a probe element. **No `!important` is needed; do not add one.**
- Styling `::-webkit-scrollbar` swaps Chromium's overlay scrollbars for classic
  space-consuming ones on those containers. That is a layout change, not just a
  paint change. It is what the design does.
- `templates/gift_card.liquid` (`{% layout none %}`) and `layout/password.liquid`
  do not load `base.css`, so they do not get this. The design links its file on
  every page; theirs is a gap to close if either is ever styled.

### Loading

**The mark, its timing, its colour, and the veil behind it are merchant-facing
now.** Theme settings → Loading Animation contains only non-colour loading
behavior: `loader_style` (Diamond, Ring, Orbit — each variant reuses the same
`loader__line`/`pathLength` contract) and `loader_close_delay`, which defaults
to eight seconds. Each color scheme keeps its own Loader, Loader on veil, and
Overlay veil roles under Colors → Interface and feedback; nothing non-colour
remains in Colors. Inline and catalogue waits use Loader. Full-screen waits use
Loader on veil so its contrast can be tuned independently from both the surface
mark and the veil.
The mark itself never has a background. A new variant is a sibling
`icon-loader-*.liquid` with inline `--n`/`--exit` on each path and a `when` in
the dispatcher — nothing else.

**One mark for every wait in the theme**, from `snippets/loader.liquid`: the
quick view while the piece is fetched, the search overlay while a query is in
flight, and whatever waits next. `{% render 'loader', label: text, size: 'sm' %}`
— `sm` / `md` / `lg`, 28 / 44 / 68px, and a label that defaults to
`general.loading`. Search remains an inline wait inside an already-dismissible
interface. Quick View is the full-screen loading state: its visible shared
Text/Icon close waits for `loader_close_delay`, while its veil and Escape work
immediately; when product content arrives, the ordinary panel close is shown
immediately.

- **The diamond is a round brilliant in elevation**, drawn to a reference given
  on request: the table across the top at 43% of the width, five crown facets,
  the girdle at the widest points, and the pavilion converging on the culet.
  Nine lines in three paths, grouped by depth.

  It replaced the design's own three-path cut — the one drawn in its image
  placeholders (`Glorious All Products.dc.html`). That mark is right where it
  lives, at 100px behind a photograph that has not arrived, and too plain at
  68px in the middle of an empty panel, which is what a wait actually shows. The
  design states **no loading state anywhere in its 24 pages** — every "loading"
  in it is `loading="lazy"` on an image — so both the shape and the movement
  here are the theme's. What is kept is its language: hairline, gold, square-on.
- **Every line is drawn, in turn**: the cut, the girdle, the crown from the
  middle out, then the pavilion. The draw sequence is
  `animation-delay: calc(var(--n) * var(--loader-stagger))`; pairs share their
  `--n`, so the mark is symmetric in every frame.
- **The exit reverses the layers, not the draw order**: all inner facets fade
  together first, then the horizontal girdle, then the outer cut. Each line's
  second animation shares the draw animation's duration and `--n` delay, while
  its own keyframe percentages compensate for that delay. Keeping both clocks
  aligned matters: opacity resets only when that line's dash resets to fully
  offset, so the next loop cannot flash a complete line into view.
- **The beat is 3.2s and the stagger 180ms, and both are about feeling like a
  wait rather than a flash.** A line takes about a quarter of the beat to draw,
  and the stagger is nearly as long as the stroke, so lines visibly follow one
  another and five to seven are moving at any moment. The strike runs to the
  middle of the beat, the whole stone stands for two thirds of a second, and
  the staged exit occupies its final third: inner facets at 2.1–2.45s, the
  girdle at 2.55–2.87s, and the outline at 2.94–3.2s. Each layer fully leaves
  before the next begins, so the exit reads inside-out rather than as one
  general fade.

  It shipped at 2.6s with an 80ms stagger, which put every line down inside the
  first second and left the rest of the cycle a still picture: measured
  0 → 38 → 92 → 100% of the ink in 800ms flat. Now the ink climbs
  0 → 7 → 19 → 38 → 58 → 78 → 92 → 100 across 1.8s.

  It was not always drawn at all. The facets used to *fade in* over an
  already-drawn outline, which reads as a picture appearing rather than a stone
  being cut.
- **One path per line, and that is load-bearing.** `pathLength` normalises a
  path's *total* length, so several lines sharing one path each get a share of
  the 100 in proportion to how long they are — the girdle would still be
  halfway drawn while a crown facet a third its length had long finished. One
  path per line means one pen speed for all of them.
- **`pathLength="100"` is what keeps it out of JavaScript.** It normalises each
  line to 100 units, so one `stroke-dasharray: 100` in the stylesheet drives
  every draw. The alternative is `getTotalLength()` in a script, and a
  decoration should not need one to appear.
- **Never `vector-effect: non-scaling-stroke` on a path that is drawn by a
  dash.** It looks made for this — a hairline that ignores scale — and it
  silently destroys the draw: the stroke moves into device space and the dash
  goes with it, so `pathLength` stops governing the dash and the same 100-unit
  pattern paints an identical row of marching dashes at every offset. Measured
  on this outline: **534 inked pixels at dash offset 0, 50 and 100 alike**,
  against 1869 / 932 / 0 with an ordinary stroke. It shipped for one commit and
  was exactly what was wrong with the animation.

  So the hairline comes from scaling the width per size instead:
  `--loader-stroke` is in the viewBox's own units — 3 / 2.4 / 1.85 — which at
  the three render scales paints 1 / 1.25 / 1.5px.

  (While it was in use it was an attribute on each path rather than a rule,
  because `vector-effect` **does not inherit** — declared on the `<svg>` it
  reaches nothing. Worth knowing if it is ever reached for elsewhere.)
- **`ease-in-out`, not the theme's `--ease`.** That curve is built for entrances
  — a thing arriving fast and settling — and on a line being struck it puts 78%
  of the length down in the first 26% of the stroke and then creeps. A pen
  accelerates and slows.
- It uses the selected scheme's `--loader-ink`, falling back only to that same
  scheme's accent role. Under reduced motion the stone is simply drawn whole
  rather than hidden: a wait with no sign of waiting is worse than a still one.
- **In the quick view it replaces a shimmering skeleton.** Nothing in that panel
  knows the shape of the piece it is fetching, so a skeleton was guessing, and a
  skeleton that guesses wrong is worse than a mark that admits it is waiting.
  The diamond sits directly on the veil; no panel surface is shown until the
  product markup establishes its real size — see the entrance note above.
- **In the search overlay it sits in the field, not in the results.** Nothing a
  visitor is already reading moves while the next query flies. It is out of
  flow, or the field would lose width the moment it appeared and the caret would
  jump, and the field carries a constant `2.25rem` end padding so a long query
  never runs under it. Measured: 25×28 at the field's right, centred on it, from
  the moment the debounce fires until the rows land.

  **An aborted request does not clear it.** Every keystroke aborts the last
  query, and the mark is still waiting — for the newer one. Clearing on abort
  makes it flicker on every letter typed.

### Tooltip

`data-tip="Label"` on anything raises the design's chip, from one delegated
controller and one element per document. Touch pointers are ignored — a tap
would raise a chip nobody asked for. It is **decorative only**: everything
carrying `data-tip` also has its own accessible name, so nothing depends on
it and nothing is announced twice.

An overlay's automatic opening focus does **not** raise its tooltip. The
controller marks the target only for the synchronous `focusin` event and
removes the marker immediately afterwards; when a visitor later tabs back to
that control, normal focus-visible tooltip behaviour still applies. Without
that distinction, Quick View opened with a black “Close” chip already hanging
from its close button even though nobody had hovered or tabbed to it.

### Overlays

Six layers share one controller in `theme.js`: `menu`, `search`, `cart`,
`quick-view`, `newsletter`, `cookie-preferences`. **All six live in the header
group** — they belong to the nav and the cards that open them, not to the
footer.

The markup contract:

| attribute | meaning |
| --- | --- |
| `data-overlay="name"` | the root; `hidden` when closed |
| `data-overlay-modal` | locks scroll, traps focus, closes on Escape |
| `data-overlay-close="name"` | any control that dismisses it |
| `data-overlay-open="name"` | any control that opens it |
| `data-storage-key` | opt in to showing itself once per visitor |
| `data-delay` | milliseconds before it does |

- **Every overlay control is delegated from the document and bound once.**
  `data-overlay-open`, `data-overlay-close` and the close-on-navigate rule all
  live in one `initOverlayTriggers()`, called from `boot()` and never from
  `init(scope)`.

  This is not a tidy-up. An overlay's markup does not stay put: `theme.js`
  re-renders the bag drawer's contents after **every** cart change and swaps
  them in, and the theme editor replaces a whole section on reload. Binding a
  listener to the close button itself meant it died with the markup it was
  bound to — the drawer's close button worked at boot and was **dead from the
  first add to bag onwards**, leaving only the veil to dismiss it, which reads
  as "the close button does nothing". `bindOnce` cannot save this: the
  replacement element is a different node and has never been seen.

  The cart handlers were already delegated, for exactly this reason. Anything
  that can appear inside re-rendered markup has to be.
- **A full-viewport overlay root must never carry a colour scheme class.** A
  scheme class sets `background-color`, so on a `position: fixed; inset: 0`
  root it paints the whole screen opaque and the veil has nothing left to
  veil. This is exactly why the newsletter and cookie popups did not read as
  overlays. The scheme goes on the *panel* — `.modal`,
  `.cookie-banner__panel`, `.drawer__panel`, `.quick-view`.
- **Exit timing is read, not hardcoded.** `afterAnimations()` asks the element
  for its running animations (`getAnimations({subtree: true})`, which includes
  CSS transitions) and waits for them, with a timeout only as a backstop. Six
  overlays with six very different exits therefore need no table of magic
  numbers kept in step with the stylesheet.
- Overlays share one reference-counted scroll lock. Adding another overlay
  means registering it there, not writing a second lock.
- **The menu's close is not its open reversed.** Rows enter top-down
  (`.05s`…`.47s`, 60ms apart) and leave **bottom-up** (`.48s`…`.06s`), and the
  backdrop only fades at `.58s`, once the last row has gone — so the overlay
  empties before it disappears. Both directions are derived from `--row` (the
  element's rank) and `--rows` (the total), both emitted by Liquid, so nothing
  assumes a particular number of menu items.
- **Action links:** a footer column entry whose URL contains `#newsletter` or
  `#cookie-preferences` renders as a button that opens that overlay instead of
  navigating (`snippets/footer-entry.liquid`). The convention deliberately works
  for Shopify menu items too, so a merchant-built menu can carry them.
- The dark overlays (`.nav-menu`, `.search-overlay`) **declare their own
  `--c-accent` and `--c-ivory`**. They are noir whatever scheme the page is
  in, and inheriting the page's accent would drop the light-background gold
  role onto a near-black surface.

### Close controls

**Every overlay close is one renderer and one theme setting.** Quick view wore
an icon disc, the newsletter a bare glyph, the drawers a word — the same
action in three costumes. `snippets/overlay-close.liquid` is now the only
thing that emits a close control, and Theme settings → Buttons → Close
controls chooses its form for all of them at once: Text (default — the
"Close" pill) or Icon (the same bordered disc holding the theme's one close
glyph). Callers pass *placement* — a context class that positions the control
and the attributes that wire it — never appearance; a context class carrying
visual style again is how quick view drifted in the first place. Both forms
paint from `currentColor`, so one rule serves the noir overlay heads and the
light panels, and both take their corner radius from the global button shape.
Announcement header alone may request that renderer and its context class only
places it at the row's end; it does not change its padding, type size, or
icon-disc dimensions. Announcement bar has no close control.
Deliberately not `snippets/button.liquid`: a close is a purpose-built
interface control, the R16 exemption. Veils, the cookie banner's
Accept/Decline, and the newsletter's "No thanks" are dismissals, not close
chrome, and stay their own things.

### Search overlay

- **Three presentations, one markup.** Theme settings → Search chooses
  full-screen menu (default), drawer, or straight to the search page. The
  field, popular terms, resting state, and results are one Liquid capture
  shared by menu and drawer modes, so they cannot drift and `theme.js` needs
  no mode awareness. `page` renders no overlay at all and every trigger stays
  a real link.
- **Drawer mode is the cart drawer's shell to the letter** — the same
  `.drawer` root, veil, sliding scheme-classed `.drawer__panel`, and
  `.drawer__head` with the shared close control — so it reads as the same
  furniture as the bag, on its own merchant-chosen scheme. The palette
  hand-over is a single property: the full-screen mode's styling paints
  entirely from `--c-ivory` mixes (noir whatever the page says), and the
  drawer's panel redefines `--c-ivory: var(--c-text)` — every shared rule then
  follows the scheme, light or dark, with the accent likewise the scheme's own
  rather than the overlay's champagne.
- Opens over the page, and on ⌘K / Ctrl+K / `/` — the design's shortcuts.
- **No client-side index.** Typing fetches
  `/search/suggest?q=…&section_id=predictive-search`, and
  `sections/predictive-search.liquid` renders the rows. Money formatting,
  translation and image sizing stay in Liquid. Matched characters come from
  Shopify's `highlight` filter, which wraps them in `<strong>`; CSS colours
  that gold.
- The resting state (Browse + Featured pieces) is **rendered server-side into
  the overlay**, so opening shows something before any request.
- The whole thing wraps a real GET form to the search route, and the nav's
  search action is a real link to it, so it degrades to the search page.

### Cart upsell

**The upsell belongs to the empty cart, and only to it.** A bag with pieces in
it is a checkout surface — everything under the lines is the money and the way
out, and a row of other products beside the checkout action is noise where it
costs most. An empty bag is a doorway, and the upsell is what fills it.
`blocks/cart_upsell.liquid` renders when `cart.item_count == 0` and never
otherwise; the old show-when-empty/show-when-items pair gave "should it show?"
two answers and is gone.

- **The source is a merchant collection, full stop.** The recommendations
  machinery the block used to carry — pending placeholder, per-section
  re-fetch, `initCartRecommendations` in `theme.js` — is removed with the
  with-items state, because a recommendation needs a seed product and an empty
  cart has none. All products stands in when no collection is chosen.
- **One piece per page, as a row.** The block projects the same composed
  `_product-card` sideways: the photograph a fixed square on the left
  (`--cart-upsell-thumb`), the merchant's composed text in a card-local Group
  beside it, the quick-view disc moved to the row's end on its centreline.
  Flex rather than the card's named `media` grid, because nothing stacks under
  the photograph here. `.cart-upsell__track` pins `--cols: 1` with a 100%
  floor, so the shared ruler measurement finds exactly one column whatever
  container the band is in.
- **The heading and the arrows are the shell's `header` placement** — a new
  `arrows: 'header'` arrangement in `snippets/row-carousel.liquid`: a hairline
  band above the track, the heading on the left, the two arrows together on
  the right, no marks. The heading sits outside `data-row-controls`, so one
  product keeps its title while the arrows go. The band's arrows are the bare
  glyph at 34px rather than the 46px track control. Any section can use the
  placement; the upsell no longer offers an arrows setting because the band
  *is* its presentation.
- Both stored copies — the drawer's in `sections/header-group.json` and the
  cart page's in `templates/cart.json` — compose photograph, product type
  eyebrow, title, and price, which is the drawer band the design sketch
  states: thumb left, facts beside it, quick view at the end.

### Cart drawer and cart naming

- `settings.cart_type` picks **one** of drawer or cart page — they are
  alternatives, never both. The drawer section renders nothing on `page`.
- **`settings.cart_name` is the storefront noun and defaults to `Cart`.** A
  merchant may set Bag, Basket, or another term; navigation, the drawer and
  page headings, empty states, engraving help, accessibility labels, and every
  Add to action derive from this one value. Theme-editor groups, setting labels,
  ids, and help text always call the feature Cart. Do not add another button
  label setting that can disagree with it.
- **Revision 14's whole change to the drawer is the footer, and it is about
  tax.** The "Subtotal" label gained the note inline — `Subtotal inc. all taxes
  and fees`, lighter (ink 45%), untracked next to the label's own 0.18em, and
  not uppercased — and the figure beside it became nothing but money.
  Revision 13's single paragraph was replaced by a gold micro-label over a
  sentence: "The price as promised" / "What you see is what you pay — every tax
  and fee already included."

  `.drawer__subtotal-label .price-tax` has to restate `font-size: 1em`, because
  `.price-tax`'s own `0.75em` would drop it to 9px against the label's 12; and
  `margin-inline-start: 0`, because the design separates the two with one space
  and `tax-note.liquid` already emits that space itself.
- **Turning the tax note off changes the words and nothing else.** The block,
  its gold label, its colours, sizes and spacing are the design's in both
  states — only the sentence swaps, to revision 13's "Sales tax calculated at
  checkout. Fully insured delivery, signed for at your door — or buy at the
  salon.", which is what the drawer has to say when the shop is not pricing
  tax-inclusively ("every tax already included" is a claim about the figure
  above it). Rendering the off state as a differently-styled paragraph made the
  whole footer change appearance, which is not what the switch is for. The
  three settings are `promise_label`, `promise_text` and `note`.
- **A line never carries the note.** It is said once, on the subtotal, in the
  drawer and on the cart page alike. Repeating it down a bag of five pieces
  says the same thing five times in the smallest type on the panel.
- **The panel is porcelain lifted, not white.** The design gives the panel
  as a lifted porcelain over a porcelain footer; the theme had the panel on
  `--c-surface`, so the two-tone read as a plain surface against porcelain. It
  is `color-mix(in srgb, var(--c-surface) 26%, var(--c-bg))` rather than a
  literal, for the reason the quick view's background is a token — the drawer's
  scheme is merchant-selectable and a fixed near-white panel would carry ivory
  text on scheme_2. The mix stays within one channel step of the reference.
- **The drawer uses three hairline weights and they are the design's, not
  `--c-hairline`.** 12% at the panel edge, under the header and above the
  footer; **10%** between lines; 14% around a thumbnail (which is what
  `--c-hairline` happens to be). The header count and a line's meta are ink at
  **50%**, not `--c-muted`.
- **The footer's two buttons carry their own values, not the `--button-*`
  tokens.** Checkout uses the dark scheme's champagne with its surface text —
  the design's primary CTA roles, also carried by `.quick-view__add` — turning
  ink on hover; Salon is an ink hairline at 35%, not the accent. Both are
  15px/22px, where the global tokens give 16px/28px. The page scheme's accent
  is the light-background gold role and is a different colour; do not reach
  for it here.
- The footer's own geometry is stated too — `20px clamp(20px,5vw,30px) 26px`,
  a 16px subtotal figure and a 10px button gap — because the spacing scale
  lands at 18.7/30.08/28.1 with a 19.18px figure.
- **Quantities are never recomputed in the browser.** Every change posts to
  `/cart/change.js` with `sections: <id>` and swaps the re-rendered
  `[data-drawer-contents]` in, so line prices, the subtotal and the item count
  are always Liquid's numbers. The count rides along on a
  `[data-cart-count-value]` element rather than a second request.
- **Both cart surfaces state each line's own quantity rule**, the product
  form's contract carried into the bag. The drawer renders
  `item.variant.quantity_rule` as `data-cart-rule-min/step/max` on the
  `.drawer-qty` control and `theme.js` learns the rule from nowhere else; the
  cart page's `updates[]` inputs carry the same rule as native
  `min`/`max`/`step`. Both arrow handlers re-snap onto the min-anchored
  increment grid before clamping — the product stepper's rule, and on the
  page the safe one, since native validation's step base is the `min`
  attribute and an off-grid value the theme itself wrote would block the
  whole cart form, the checkout submit included. The two surfaces part ways
  only at the bottom, each toward its own removal path: the drawer's minus
  below the minimum *is* the removal (the same press that meant "below one"
  while the rule was the default), while the page's discs clamp at the
  minimum because its removal is the `url_to_remove` link — typing 0 to
  remove went with the old `min="0"`, a zero being below the minimum the
  shop sells and a blocked form being worse than a second click. On a shop
  without quantity rules every rendered attribute is the old integer grid
  exactly. The arrows only choose the requested quantity; the money and the
  count still come back from Liquid.
- **Product, cart page, and cart drawer share one `.quantity-control` visual
  contract.** Their data hooks stay separate because the Product form, native
  cart form, and drawer re-render have different update mechanics; the grid,
  three column sizes, border, radius, glyph buttons, and value styling do not.
- **A press while a change is in flight is held, not dropped.** `cartBusy` used
  to `return` outright, so pressing + three times quickly moved the bag by one.
  Presses inside 220ms now coalesce into one request and anything arriving
  mid-flight is kept as `cartPending` and sent when the line frees. Measured:
  three rapid presses take a line from 3 to 6. A removal flushes immediately
  rather than coalescing — it is the last thing that line will say. Jobs use
  Shopify's stable line key rather than a numeric position, so a preceding
  removal cannot shift a queued press onto the wrong piece.

  The **number** under the pointer is written on the press so the control
  answers at once. That is the count, not a price; nothing here does arithmetic
  on money, and the re-render that follows overwrites it.

  `applyCartSection` restores `[data-drawer-scroller]`'s `scrollTop` on the
  newly rendered scroller across the swap (the old node is detached), or a
  scrolled list jumps to the top on every step.
- **Emptying the bag is a hand-over, not a swap.** It changes the whole panel
  at once — the count leaves the header, the list becomes a message, the footer
  goes — and no amount of animation on the arriving empty state fixes the jolt,
  because the *outgoing* markup never animates: it is replaced, not removed.
  So `.drawer__body` and `.drawer__foot` fade (`gj-fade-out`, 0.18s), the swap
  happens behind the fade, and what arrives fades back in (`gj-fade-in`, 0.3s
  on `.drawer-lines` and `.drawer__foot`) — except the empty state, which has
  its own stagger and would otherwise be double-animated.

  **The header is deliberately outside all of it, and that is the fix for a
  flash.** Fading `.drawer__inner` as a whole took the title and the close
  control with it; since a fill-forwards fade ends at opacity 0 and the
  attribute is dropped on the swap, the entire panel snapped from invisible to
  visible in one frame. Holding the header still also reads better: the bag is
  not blinking, its contents are changing under a heading that stays put.
  Ending the arrival on opacity 1 is what makes dropping that attribute a
  no-op — the outgoing direction is the one that needs care.

  **Removing the last line skips the row collapse entirely.** Collapsing it
  first left an empty list sitting under a stale subtotal for as long as the
  request took, and then jolted. The last line instead starts the fade on the
  press, so it covers the request. Every other line starts its row collapse and
  `/cart/change.js` request in the same frame; a fast response waits only for
  the measured 0.34s exit, while a slower response arrives behind an already
  closed gap. The earlier animation-then-network sequence made Remove feel
  stalled. The row now uses opacity and a small translation without blur, so
  the required layout collapse does not also pay for a filter repaint. The
  rest of the panel never moves.

  A step between two non-zero quantities does not fade the panel — a number
  changing is not a state change, and fading on every press would be worse than
  the jolt. It gets one beat of its own instead: `[data-drawer-subtotal]` plays
  `gj-value-in` (0.32s, a 4px lift) **only when the money actually differs
  after the swap**, so stepping a line that leaves the subtotal alone stays
  still. The figure is a flex item and so already blockified; the
  `display: inline-block` on it only matters if the class is reused elsewhere.

  Two mechanics make it work, and they live in **`afterFade`** now — shared
  with the row carousel's fade, which is the same hand-over. `afterAnimations()`
  asks for running animations the moment it is called, and one matched by an
  attribute set in the same tick does not exist until the style is recalculated
  — hence the `void el.offsetWidth` the helper does first. And its fallback is
  the stylesheet's own duration, passed in by the caller, so both paths land
  together whether or not `getAnimations()` reports the fade. **Do not "tidy"
  either away.**
- **The empty state is centred in the body**, not sitting at the top of it: the
  panel is full height and the message is the only thing in it, so the design's
  52px of padding left it stranded under the header. `.drawer__body:has(>
  .drawer-empty)` becomes `display: grid; align-content: center`, guarded by
  `:has()` so the lines list — which must start at the top and scroll — is
  untouched. Grid rather than a flex `margin: auto` because grid keeps the
  overflow reachable in both directions if the block ever outgrows a short
  viewport. Measured: 328px above and below in a 958px body.
- **The empty state's entrance is the theme's own, not the design's.** The
  design's empty bag is static. This is `gj-row-in` on its three children,
  60ms apart on the design's easing — the menu overlay's idiom, the search
  overlay's keyframe. No script: it restarts on every open because the overlay
  root goes `display: none` → `grid`, and again on the swap, that bringing in
  fresh elements. The global `prefers-reduced-motion` rule flattens it.
- **A line's price is the price of one piece, not price × quantity.** The
  quantity is stated on its own directly beside it, so multiplying it in says
  the same thing twice and makes a line of three read as a piece costing three
  times what the card said. `settings.cart_unit_price` (Theme settings → Cart)
  turns it back into the line total, in the drawer and on the cart page alike.
- **A line's photograph is framed like a product card's**, from the same kind
  of pair — `cart_image_ratio` and `cart_image_fit` under Theme settings → Cart.
  The shape can differ per line (`adapt` takes each photograph's own), so it is
  emitted as `--drawer-thumb-ratio` on the thumbnail itself and only the fit is
  a global token, `--cart-thumb-fit`. The crop Shopify is asked for is derived
  from the same ratio rather than hardcoded; `adapt` asks for no crop at all.
  The default stays 3:4 — the design's is square, and the departure is the
  documented one below.
- **A line's choices are one per row, in a single span.** `snippets/line-
  options.liquid`, shared by the drawer and the cart page. Design revision 13's
  entire change to the bag drawer was adding `white-space: pre-line` and
  `line-height: 1.55` to this span, because `gj-variants.js` had started
  handing it a multi-line label:
  `variant: label(id, v).split(' · ').join('\n')`.

  So the newlines are **data, not markup** — one span carrying `\n`s, not one
  element per value. Splitting them into separate elements looks identical
  today and stops matching the moment the design changes how it joins them.
  Liquid has no newline literal; `{% capture nl %}` around a bare newline is
  what produces one (verified: `probe.size` 3 for `'A' + nl + 'B'`).

  **Karat and metal share a row; everything else gets its own.** "18K Yellow
  Gold" is one fact about the piece, where `18K` stacked above `Yellow Gold`
  reads as two unrelated choices. The joined line takes the place of whichever
  of the pair the merchant ordered first, so the row order stays theirs, and
  the other is skipped. Same composition as the card's caption. Verified on a
  real line: `["18K Yellow Gold", "6.5 in"]`.

  The design lists only what the customer moved off the catalogue default —
  "metal, weight and size always; the rest only when the customer moved it".
  Shopify has no notion of a default option *value*, so every option is
  listed: the same information without the shop's opinion of which parts are
  ordinary. Line item properties follow, quoted as the design quotes engraving
  (`'“' + text + '”'`); `_`-prefixed properties stay hidden by convention.

  `1.55` is stated on `.line-options` rather than left to `--product-line` so
  it applies only where the text actually runs to several rows — the card's
  single-line caption keeps the 1.5 it was given under "Product text". The two
  rules have equal specificity, so **`.line-options` must stay below
  `.drawer-row__meta` and `.card__meta` in the file**; source order is what
  decides it.

  `has_only_default_variant` replaced a `variant.title contains 'Default'`
  test, which was guessing at Shopify's "Default Title" from a string and
  would misfire on a real variant named "Default".
- **The line thumbnail is portrait, not the design's square.** A departure on
  request: the design's is 64×64, and a pendant or a drop earring sat small in
  it with white above and below. `--drawer-thumb-ratio` is `3 / 4` — the
  product card's frame — at the design's 64px width, so the row's columns are
  unchanged. The image is requested cropped to the same 3:4 rather than to a
  square, so Shopify centres the piece in the taller box instead of the browser
  cropping a square to fit. Measured: 64×85.
- Removal collapses the row (`grid-template-rows: 1fr → 0fr`, which *is*
  animatable, unlike height) while the Cart API request is in flight, then
  drops the line when both are ready.
- The bag action stays an `<a href="/cart">`; JavaScript intercepts it. Same
  for search. Nothing here is load-bearing without scripting.
- Cart handlers are **delegated from the document and bound once**, because
  the theme editor replaces section markup wholesale — a listener bound to the
  drawer element would either stack up or point at detached markup. For the
  same reason `registerOverlay` replaces a registration whose element has left
  the document.

### Product text

A piece is named, priced and counted in more than one place, and it reads the
same in all of them: the card's caption, the drawer's rows, the cart page.
The type is **one set of `--product-*` properties at `:root`** in `base.css`
— title 14.5px/.09em, price 15px/.08em, meta at `--micro-size`, all on a 1.5
leading. The card's own `--card-*` properties keep everything else (padding,
the quick-view disc, `--card-zoom`, the edge colour).

- **This is a deliberate departure from the design, on request.** The design
  sets the drawer's line name in Italiana at 16.5px/.05em/1.3 against the
  card's Karla at 14.5px/.09em/1.5, and its drawer price at 14.5px/.06em
  against the card's 15px/.08em. They are the card's numbers now, in both
  places. `Bag Drawer.dc.html` is still the reference for everything else in
  the drawer.
- **`:root`, not `.card`, is the load-bearing part.** `.card__title`,
  `.card__price` and `.card__vendor` were already being reused outside a card
  by the cart, blog, product, search and collection-list templates — where a
  `.card`-scoped custom property is undefined, so `font-size` and
  `line-height` were invalid at computed-value time and silently fell back to
  the inherited size. Verified: `--card-title-size` computed to `""` on
  `/cart`. Reuse a `card__*` caption class anywhere and it now works.
- `.card__meta`'s margins are the exception and stay card-scoped, with a `0`
  fallback (`var(--card-meta-gap, 0)`), so outside a card the class is caption
  type only and the surrounding stack does the spacing.
- The drawer panel resets `line-height` to `normal` (see `--body-leading`,
  above), so **every one of these rules states its own** — including
  `.drawer-row__meta` and the shared `.quantity-control__value`, which did not
  need to before.

### The tax note

**It is the cart's, and only the cart's.** It used to follow every price in the
theme — the product card, the quick view, the lookbook, the search rows, the
product page — under one shop-wide switch. It is rendered by the bag drawer and
the cart page and by nothing else, on request. A qualification repeated beside
every figure in a grid of twenty-four is noise; the place it matters is the one
where the customer is about to pay. Verified: **0 `.price-tax` elements** on the
home page, and the cart reading "Subtotal: $4,376.70 inc. all taxes and fees".

**Two settings, in two groups, because they are two decisions.**

| | |
| --- | --- |
| Theme settings → **Tax** | `tax_note_text` — the *words* |
| Theme settings → **Cart** | `show_tax_note` — whether the bag says them |

A shop states how it prices once, and that is a fact about the shop; whether
the bag repeats it is a question about the bag, and the bag is where it is
said. The old **Pricing** group held only that one checkbox and is gone.

- **The wording moved out of `locales/en.default.json`, reversing what this
  file used to say** — "changing 'inc. all taxes and fees' to 'inkl. MwSt.' is
  a localisation, not a per-shop style choice". The reason it was wrong: the
  sentence is not one of a fixed set the theme knows how to translate. A shop
  pricing tax-exclusively needs to say something the theme never wrote, so it
  has to be a setting. A shop needing it in a second language translates the
  *setting*, which Shopify's own locale editor does.
- **The `short` parameter went with the card.** There were two wordings because
  a card's price line is one row beside the figure at 15px and the longer
  sentence wrapped it. Nothing narrow renders this any more.
- **A card can still say something beside its price** — a Text
  block in the price row, which is what carried "inc. all taxes" there for one
  commit. That is the merchant composing a line, not the theme applying a
  shop-wide rule, and it is the difference worth keeping in view: the setting
  is about how the *shop* prices, the block is about what *this row* says.
- **Do not reintroduce a section-level toggle.** `featured-products`,
  `lookbook` and `cart-drawer` each carried one ANDed with the shop-wide
  switch, which gave "is it on?" two answers.

### Compare-at prices

**A compare-at price is struck through beside the current price on every
product surface, and which side it sits on is one shop-wide choice.** Theme
settings → Prices → `price_compare_position` — Before the price (the default)
or After it. Liquid renders the two figures in the chosen order on every
surface; CSS never reorders them, because the struck figure sits in inline
text flow where structural pseudo-classes cannot tell an element from the
text node beside it. The one thing CSS moves is the *gap's side*:
`theme.liquid` emits `data-price-compare="after"` on the body only in that
mode, and `.card__price s`, `.drawer-row__compare` and `.cart-line__compare`
swap their 0.5em margin under it.

- **The surfaces that price a variant all strike `compare_at_price`**: the
  shared `card-price` renderer (Product card, Hotspot card, the upsell), the
  Product price block (Main product, Featured product, Quick view), and the
  option rows' pre-rendered fragments in `_product-card-option-control` and
  `_product-card-add` — which is what keeps a swatch pick honest, since
  `theme.js` swaps `[data-card-price]`'s whole `innerHTML` from those
  fragments and never assembles money itself. `main-product.js` is
  order-agnostic by construction: it finds `[data-product-compare]` by
  attribute and toggles `hidden`, so the block's Liquid owns the order.
- **The meta rows say it in the sentence.** The lookbook hotspot row, the
  search overlay's featured rows and predictive search's live rows carry
  "kind · price" as one string, so the struck figure joins that string with a
  literal space rather than a margin — text flow is what spaces words. A
  "From" price never carries a struck figure: `price_min` against a
  compare-at chosen from a different variant would strike one number with
  another product's story.
- **The cart strikes what a discount changed, never the compare-at.**
  `original_price` against `final_price` per piece, or the line pair when
  `cart_unit_price` shows line totals — the same unit-or-line mode as the
  visible figure, because a per-piece price struck through by a line total
  pairs two quantities in one sentence, which is the bug the cart page
  actually had. Compare-at stays out of the bag deliberately: checkout will
  not echo a compare-at saving, and a figure the bag claims that checkout
  withdraws is the dearest-variant price trap again. The drawer and the cart
  page render the identical pair, which is the "every Cart setting acts on
  both" rule doing its job.

### Cart settings

**The drawer and the cart page are alternatives, and every Cart setting acts on
both.** A cart should not be able to do different things depending on which the
shop has chosen, so each of these is the same setting reading the same object
in `snippets/cart-drawer-contents.liquid` and in `templates/cart.liquid`.

| | |
| --- | --- |
| `cart_name` | the customer-facing noun — Cart by default |
| `cart_type` | drawer or page — never both |
| `cart_drawer_on_add` | the drawer opens after an add |
| `show_tax_note` | the Tax note follows the subtotal |
| `cart_note` | a message to the seller, submitted with the order |
| `cart_discounts` | lists cart-level discounts above the subtotal |
| `cart_installments` | `payment_terms` |
| `cart_accelerated_checkout` | `payment_button` |
| `cart_empty_link` | where an empty cart's button goes |
| `cart_image_ratio` `cart_image_fit` | the frame a line's photograph sits in — drawer **and** page |

- **The image pair genuinely acts on both surfaces now.** It did not: the cart
  page carried its own duplicate `image_ratio`/`image_fit` on the Main cart
  section, so Theme settings → Cart → "Image shape" changed the drawer and
  left `/cart` exactly as it was — "what shape is a line's photograph?" had
  two answers, only one of which the theme-settings control could reach. The
  section pair is removed; `main-cart.liquid` reads the theme settings, and
  `adapt` — which has no single value to put on the section root — is emitted
  per line from each photograph's own dimensions, exactly as the drawer does
  it. A drawer line with `adapt` and no photograph falls back to the pair's
  own 3/4 rather than emitting the invalid `--drawer-thumb-ratio: /` that
  collapsed the empty bordered thumb.
- **The drawer's actions became `{% form 'cart', cart %}`, and that is what
  makes three of these possible at all.** `payment_terms` and `payment_button`
  are filters *on a form object*, so a hand-written `<form action="/cart">` —
  which is what the drawer had — cannot have them. Shopify emits the same
  action, method and hidden fields it was writing out by hand.
- **Checkout is a named submit with a non-empty value on both surfaces.** The
  shared Button used to emit `name="checkout"` without a `value`, which posts
  `checkout=`. Shopify's local theme handoff treated that as an ordinary cart
  update and returned to `/cart`; `button_value: 'checkout'` now makes the
  intent explicit while keeping the native cart form, note, quantities,
  payment terms and accelerated checkout intact.
- **The last two render nothing where the shop has not enabled them**, which is
  Shopify's own behaviour: the setting decides whether to *offer* the feature,
  not whether it appears. Measured on this store, which has no wallet enabled:
  the setting is on and no payment button is in the DOM. That is correct, and
  it is why the info text says so.
- `cart_empty_link` is a `url` setting, so it carries no schema default —
  Shopify's `url` type takes none. Both surfaces fall back to
  `routes.all_products_collection_url` in Liquid rather than shipping a control
  that looks live and goes nowhere.

Verified with a line in the bag: the note field renders on both surfaces with
`name="note"` and a matching `label[for]`, the drawer's form posts to `/cart`,
the checkout buttons post `checkout=checkout`, the handoff leaves `/cart` for
Shopify checkout, and the subtotal carries the note.

### Content and utility templates

**Article cards are compositions now, not one bundle of visibility toggles.**
`main-blog` still owns the Shopify article loop and renders one static
`_article-card` for every result. That card now contains independently
reorderable Article image, Article details, Article title, Article excerpt and
the global Button, with ordinary editorial blocks available beside them.

- Article title is the non-truncating Text contract and can link to the current
  article. Article image is the Media presentation contract without an image
  picker; it reads `article.image`, its admin focal point, and the shared
  responsive/LQIP renderer. Article details is Text whose value is date,
  author, or both. Article excerpt is Rich text, optionally falling back to a
  word-limited article body on cards. The Blog card image stays lazy; the
  Article page image keeps eager loading because it is the route's likely LCP.
- The Article template uses those same contextual blocks. Its composed header
  owns Article title and excerpt; `main-article` renders reorderable details
  and image before the fixed native article body, comments and neighbour
  navigation. Removing an image or details block is the show/hide control, so
  the section no longer carries parallel visibility and media settings.
- R23 protects the source, renderer, non-truncating title, no-uploader image,
  default Blog card tree and default Article composition.

- **Ordinary pages, 404, blogs, articles and the collection index are JSON
  templates.** Their headers and editable prose use the same global Group,
  Text, Rich text and Button blocks as the home page. Do not put a second
  page-heading system into a contextual section.
- **Contextual sections own only contextual work.** `main-blog` loops Shopify
  articles through one static composed `_article-card`; `main-list-collections` loops
  Shopify collections through the existing static `_collection-card`;
  `main-article` renders contextual details/image blocks, the article body and
  its native neighbour links; and
  `contact-form` owns Shopify's `{% form 'contact' %}`. Everything surrounding
  those objects remains merchant-composed blocks.
- **The collection index reuses Collection card exactly.** Its contextual
  Collection title, Collection image, count, reveal and arrow therefore inherit one card contract instead of a
  lookalike maintained by the template. The native `collections` array is
  paginated by the section's Collections per page setting and uses the shared
  catalogue pager rather than rendering an unbounded index.
- **`policy` is the platform exception, and the wrap lives in the layout.**
  Shopify has no policy template type at all: `/policies/*` renders the
  platform's own `.shopify-policy__*` markup through `content_for_layout`,
  so `theme.liquid`'s policy branch is the one hook a theme has. (An earlier
  note here described a `templates/policy.liquid` holding a static
  `main-policy` section; no such files ever shipped, and the orphaned
  `sections.main_policy` schema-locale keys went with this rewrite.) The
  branch renders the design's legal-page scaffold — its Terms, Privacy,
  Cookies, Disclaimer, and Returns pages all share it — around the native,
  admin-edited content:

  - **The hero is Liquid's.** It looks the current policy up by URL in
    `shop.policies` and states its title; only when that lookup succeeds
    does CSS hide the platform's own `.shopify-policy__title`, so an
    unmatched route keeps a heading. The meta row states the shop
    (`store_display_name`, `shop.name` fallback) and its city from
    `shop.address` — platform data, not new settings. The design's "Last
    updated" date has no native source — the policy drop carries no date —
    so the theme does not invent one.
  - **Merchant content maps onto the design's treatments by element.** An
    `h2` opens a numbered, hairline-topped section — CSS counters supply
    the gold two-digit numerals, so the numbering can never disagree with
    the content — with the design's between-section rhythm rebuilt by
    splitting each section's padding into the h2's margin and padding
    across the hairline. `ul` rows are the gold em-dash rows, `ol` rows the
    gold "1." step rows, `h3`/`h4` the uppercase micro sub-heading at body
    face, `strong` the 500-weight full-ink lead-in, and body links
    underline at the design's 3px offset. The three distances are sibling
    rules: 14px marks a change of block kind, 12px a paragraph following a
    paragraph, 8px a row following a row. The body's closing hairline is
    gated on `:has(h2)` so a policy written as plain paragraphs is not
    framed by rules that belong to sections.
  - **The rail's "On this page" list is built by `initPolicyToc` from the
    rendered h2s**, assigning ids only where missing — a stored list could
    disagree with the content; this one cannot. Liquid renders the head
    and divider `hidden`, so without scripting the rail holds only the
    server-rendered links to the other policies, and the divider appears
    only with something on both sides of it. The reading position lights
    its link (`aria-current`, the hover colour): the current section is
    the last heading above the reading line, asked positionally on a
    rAF-throttled scroll rather than through an observer, because a
    section taller than the viewport has no heading on screen and must
    stay current — visibility is the wrong question; order is the right
    one. The 120px line sits just past the headings' 110px scroll-margin,
    so a jump lands with its own link lit. Links insert *before* the
    divider: the design keeps the page's own headings above it, and the
    mobile tier hides exactly what follows it. Below the design's 760px
    the rail becomes a wrapping pill row — a container query on
    `.policy-page`, which is full-bleed, so the 47.5rem threshold equals
    the design's own viewport query.
  - **The literals live in `--policy-*` properties** on `.policy-shell` in
    `content-pages.css`, the hero's arrangement: these pages are
    art-directed in fixed sizes the fluid scales cannot express without
    changing them. Colors route through scheme tokens — the design's gold
    is `--c-accent`, its rgba inks are `color-mix()` of `--c-text` — and
    the faces through `--font-display`/`--font-body`, so the formatting is
    the design's while the palette and fonts stay the merchant's. The
    design's `.3s color` hovers ride `var(--duration) var(--ease-ui)`, its
    `gjUp` entrances the tokenized `--ease-out` curve.
- Replacing a remote Liquid template with a same-name JSON template is a
  two-step development-theme migration: delete only the old Liquid filename
  first, then upload the JSON file. A watcher that has already recorded the
  collision must be restarted after the deletion.

### Cart page

- `templates/cart.json` contains one contextual `main-cart` section. The cart
  object, line-item options, properties, selling plans, discounts, quantities,
  note, totals, tax note, payment terms and checkout submission stay native
  Shopify data and forms; the theme only composes their presentation.
- The cart page and cart drawer read the same Theme settings for the cart name,
  unit-versus-line price, note, discounts, tax wording, installments and
  accelerated checkout. They are two presentations of one cart contract.
- Quantity discs only change the matching native `updates[]` input. The Update
  button remains a normal cart-form submission. Remove remains Shopify's real
  `url_to_remove` fallback, while `main-cart.js` upgrades it to a section-rendered
  `/cart/change.js` request: the measured line fades and collapses during the
  request, totals and global count come from the returned Liquid markup, and
  the empty state enters without a full-page reload. Unsaved note and quantity
  drafts on surviving lines are copied into the authoritative replacement.
  Reduced-motion mode skips the wait, and a failed Ajax request restores the
  real URL path.
- Width and image decisions use named presets. Do not replace the summary-width
  preset with a pixel slider; its narrow/medium/wide choices are intentionally
  stable responsive art direction.

### Customer accounts

- The Header uses Shopify's native `<shopify-account>` component whenever
  customer accounts are enabled. It is not replaced by a hand-built drawer and
  it is never hidden at compact widths: current Theme Store requirements demand
  the component on desktop and mobile.
- `customer_account_menu` is a menu picker whose default is
  `customer-account-main-menu`, keeping the storefront sheet and hosted account
  navigation on the same merchant-managed links.
- Shopify's new customer accounts redirect away from the theme and are branded
  in Checkout and accounts. The seven `templates/customers/*.json` files are
  compatibility surfaces for stores still using legacy accounts; they retain
  native Shopify forms and objects rather than emulating authentication,
  orders, addresses or returns in theme JavaScript.
- Self-serve returns belong to new customer accounts. Do not add a theme form
  that pretends to create return requests: a legacy order page can display the
  order faithfully, while Shopify or an account app owns the actual workflow.

### Things that cost time once

- **A tag delimiter inside a `{% liquid %}` block closes it — inside a
  `comment` too.** The block's body is scanned for its own closing delimiter
  before anything in it is parsed as tags, so a comment *quoting* Liquid ends
  the tag at the first `%}` it contains. Everything after is emitted as markup
  and the `comment` is never closed, which is what the error says:

  ```
  blocks/_product-card-option-control.liquid
  Liquid syntax error (line 99): 'comment' tag was never closed
  ```

  Line 99 is where the comment opened, not where the damage was — the quoted
  delimiter was three lines below it. This is the same shape as the two traps
  already recorded about prose: R08 flagging the comments that explain R08, and
  the `range` regex that could not cross the brace in `visible_if: "{{ … }}"`.
  **Describe a tag in words inside a `{% liquid %}` comment; never quote one.**
  A `{% comment %}` block out in the markup is not affected and can quote
  freely — every other note in this theme that shows Liquid is one.

- **The ring-builder app steals every internal link, in the capture phase.**
  `key-common-global.js` runs
  `document.addEventListener("click", handlePageTransitionClick, true)` and, on
  any `a[href]` it considers internal, calls `preventDefault()` and then
  `setTimeout(() => window.location.href = …)` — its own "page transition".

  Every trigger in this theme is deliberately a real link, so all of them
  match. Capture beats the theme's delegated bubble handlers, so the order was:
  the app schedules a navigation, the theme opens the overlay, the timer fires.
  **That is the bag drawer flashing open and the page going to `/cart` anyway**,
  and the same for search, quick view and the metal swatches.

  The app does bail on `if (event.defaultPrevented) return`, so claiming the
  click first is enough — no need to fight it. `assets/theme.js` therefore has
  a capture-phase listener that calls `preventDefault()` for exactly the
  triggers the theme is about to handle, tested with the same conditions as the
  handlers themselves, so a trigger whose overlay is absent stays an ordinary
  link.

  **It is registered at module scope, not inside `init()`, and that is the
  whole trick.** Both scripts are `defer`; deferred scripts execute in document
  order; `theme.js` is script #2 against the app's #44. Registering during
  theme.js execution therefore lands before the app's, and two capture
  listeners on the same node fire in registration order. Move it into `init()`
  — which runs on `DOMContentLoaded`, after every deferred script — and the app
  wins again.

  Diagnostic if it returns: put a `beforeunload` listener that records
  `new Error().stack` into `sessionStorage`, click the trigger, then read it
  back on the next page. The stack named the app file and line directly.
- **`overflow-x: hidden` breaks every `position: sticky` on the page, and it is
  invisible from the sticky element itself.** Setting `hidden` on one axis
  forces the other to compute to `auto`, which makes the element a **scroll
  container**. Everything inside then measures its stickiness against *that*
  box instead of the viewport — and because the page actually scrolls the
  viewport, the sticky element's own scrollport never moves, so it never
  sticks. Nothing about the sticky rule looks wrong when this happens: it
  computes `position: sticky`, its `top` is right, and its parent has room.

  **Use `clip`.** It refuses the overflow without creating a scroll container.
  Keep `hidden` on the line above as the fallback for engines that do not know
  `clip`. `base.css` does this for both `html` and `html body`.

  The `html body` selector is deliberate: the **ring-builder app extension**
  ships `body{overflow-x:hidden}` in `productViewData.min.css` and loads after
  the theme's stylesheet, so a plain `body` rule loses to it. If the lookbook's
  list stops sticking again, check for a new app doing the same thing — the
  diagnostic is to walk the sticky element's ancestors and look for any whose
  computed `overflow` is neither `visible` nor `clip`.

- **Renaming a theme block type orphans every stored instance of it, including
  ones a merchant added in the editor that no local file knows about.** The
  server validates `templates/*.json` against the blocks folder it has, so a
  stored block whose `type` no longer exists fails the whole template with
  `Invalid value for type in block 'x'. The given theme block type must be
  defined in the theme blocks folder.`

  Renaming `collection-list-subheading` → `subheading` produced exactly that,
  and the block keys are how to read it: `collection_list_subheading_6aw8tH`
  carries the theme editor's own random suffix, so it was added in the editor
  and existed only in the *remote* template. Migrating `templates/index.json`
  covers the blocks this repo knows about and cannot cover those.

  So a block type is a **data contract, not just a filename**. Rename one only
  with the reconcile in hand:

  ```bash
  shopify theme push --only "blocks/*"
  shopify theme push --only templates/index.json
  ```

  Blocks first — the template validates against the server's copy of the
  folder, which is the same ordering trap as a new section and its template.
  Restarting `shopify theme dev` does both in one pass and is usually enough.
  Either way the editor-added blocks are discarded rather than repaired; to
  keep them, `shopify theme pull --only templates/index.json` first, repoint the
  stale `type` strings by hand, and push that back.
- **A brand-new section and the template referencing it can race on upload.**
  `templates/index.json` reaching the server before `sections/foo.liquid` fails
  with `Section type 'foo' does not refer to an existing section file`, which
  reads like the file is missing or malformed when it is only late. Add the
  section file, let it upload, *then* reference it — or pull the reference out
  of the template, reload, and put it back.
- **Section group JSON validates against the server's copy of the section
  schema.** If a `.liquid` fails to upload, its group errors with a misleading
  `Invalid value for type in block 'x'. Type must be defined in schema` even
  though the local file defines it. The fix is to force the `.liquid` to
  re-upload with a *real* content change — rewriting the file with identical
  bytes does nothing, because the CLI hashes content. This is not a block
  key/type collision; a key matching its type is fine (verified).
- **Do not trust visual measurement in a browser pane that is not displayed.**
  `document.visibilityState` is `hidden`, so `requestAnimationFrame` never
  fires and CSS transitions do not advance. Scroll handlers appear dead and
  transitioned properties read as their start values, which looks exactly like
  a bug. Verify the cascade statically, or open the pane.

  **`ResizeObserver` is starved the same way** — its callbacks are delivered
  before paint, and a pane that never paints never delivers them. So is the
  pane's own resize tool, which changes the viewport without dispatching a
  `resize` event. Anything driven by either appears broken while being
  perfectly correct: dispatch `new Event('resize')` by hand to test it.
- **A collapsing panel needs three elements, not two.** The grid animating
  `1fr → 0fr`, then an element that does *nothing but clip*
  (`overflow: hidden; min-height: 0`), then the content carrying the padding.
  Put the padding on the clipping element and it cannot be clipped away, so a
  collapsed panel keeps showing a sliver of its first row. The footer
  accordion and the bag drawer's row removal both use this shape; copy it
  rather than flattening it.
- **Footer disclosures and the global Accordion share markup and motion, but
  not content policy.** Both use `.disclosure__toggle`, the plus/minus mark,
  and the same three-layer 0fr/1fr panel transition. Footer opens one link
  column at a time in `initFooter`; global Accordion instances are independent,
  can begin open, and may become permanently expanded at the desktop query.
- **Never edit a theme file in place with a tool that writes a temp file
  beside it.** `sed -i` does exactly that — it writes `sedXXXXXX` in the same
  directory and renames it over the original — and `shopify theme dev` watches
  those directories, so the watcher sees a new theme file and uploads it. A
  `sed -i` across three sections and a block produced upload attempts for
  `sections/sedqvvMWG`, `sections/seduudBTX`, `sections/sedWZvqks` and
  `blocks/sedCm3KYF`, each followed by a delete. Nothing reached the store only
  because the session was failing to authenticate at the time; with a working
  session they would have landed on the remote theme as junk and then been
  removed.

  Nothing is left behind locally — `sed` renames its temp away — so `git
  status` is clean afterwards and the only trace is in the dev server's log.
  Which is what makes it worth writing down: the evidence disappears.

  Use an editor that writes the file in place. The same caution applies to any
  `python -c "... open(p,'w') ..."` that writes to a sibling path first, and to
  editor swap files if one is ever pointed at this tree.

  **Claude Code's own Edit/Write tools are a carrier**, and `assets/` is where
  it bites. An edit to `assets/base.css` produced an upload attempt for
  `assets/base.css.tmp.50276.a4f0c56b82c3` — the tool's atomic write, a temp
  file renamed over the original in the same directory. Sections and blocks
  merely upload junk and delete it; **assets also burn the Asset API's rate
  bucket**, so a run of quick edits to `base.css`/`theme.js` ends in
  `Too many updates in a short period` and the dev server serving its error
  page for several minutes — with every retry the watcher makes extending the
  window. Batch asset edits, and when the throttle hits, stop touching
  `assets/` entirely until the storefront serves again; one clean save after
  the quiet period is what clears it.
- **Audit every `range` after touching one.** Shopify validates the two rules
  server-side and `theme check` does not, so a bad step only shows up as
  `Failed to Upload Theme Files` with `default must be a step in the range`.
  This one-liner checks the whole theme at once:

  ```bash
  python3 -c "import json,re,glob;R=[];[R.extend([(p,r) for r in re.findall(r'\{[^{}]*\"type\":\s*\"range\"[^{}]*\}',open(p,encoding='utf-8').read())]) for p in glob.glob('sections/*.liquid')+['config/settings_schema.json']];[print(p,r) for p,r in R if (lambda d:(d.get('default',d.get('min',0))-d.get('min',0))%d.get('step',1) or (d.get('max',0)-d.get('min',0))/d.get('step',1)>101)(json.loads(r))]"
  ```
- **Audit every schema `t:` path too, and know that `theme check` only covers
  half of them.** `TranslationKeyExists` reads the section schemas but **not
  `config/settings_schema.json`**, so a theme setting can point at a key that
  was never written and the file still returns `[]` — the theme editor then
  shows the raw `t:` path where the help text should be. That is exactly how
  `settings_schema.cart.cart_image_fit.info` shipped missing.

  Note these resolve against `locales/en.default.schema.json`, a different file
  from the storefront's `| t`. This walks every reference in the settings
  schema and in every section schema and prints the ones that do not land on a
  string:

  ```bash
  python3 -c "import json,re,glob;L=json.load(open('locales/en.default.schema.json',encoding='utf-8'));R=lambda p:(lambda n:all([(n.__setitem__(0,n[0].get(k)) if isinstance(n[0],dict) else n.__setitem__(0,None)) or isinstance(n[0],(dict,str)) for k in p.split('.')]) and isinstance(n[0],str))([L]);T=lambda o:[o[2:]] if isinstance(o,str) and o.startswith('t:') else (sum([T(v) for v in o.values()],[]) if isinstance(o,dict) else (sum([T(v) for v in o],[]) if isinstance(o,list) else []));K=T(json.load(open('config/settings_schema.json',encoding='utf-8')));[K.extend(T(json.loads(b))) for p in glob.glob('sections/*.liquid') for b in re.findall(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}',open(p,encoding='utf-8').read(),re.S)];[print('MISSING',k) for k in sorted(set(K)) if not R(k)]"
  ```
- **A `.display` heading has no bottom gap of its own.** Its line-height is
  below 1 (`--display-leading`, 0.95), so the box ends level with the letters.
  Every section that has a subheading gets its breathing room from
  `.section-header`'s bottom margin — so a section *without* one had its grid
  sitting flush against the title, and nothing in that section's own CSS
  looked wrong. `.display + .grid-auto` now carries the margin the header
  would have contributed. Watch for the same shape if a display heading is
  ever followed directly by something other than a grid (`.split` after the
  About heading is the current near-miss, at 22px).
- **`--body-leading` inherits into UI text and silently inflates spacing.**
  `body` carries 1.85, which is right for prose and wrong for single-line
  labels, chips, pills and headings. It adds ~8px of half-leading above and
  below each one, so a component's gaps read far larger than the margins say:
  the hero's 26/12/20/12 column looked like 35/20/38/20, a 22px drawer title
  landed in a 56px box, a 12px close pill in a 40px one. Nothing about the
  margins is wrong when this happens, which is what makes it hard to see.

  The design's own `body` sets no line-height: prose declares its leading and
  UI text stays at `normal`. `.hero`, `.nav-menu`, `.search-overlay` and
  `.drawer__panel` restore that at the component root rather than patching a
  dozen selectors. **Any multi-line text inside them must state its own
  line-height** — they all do, and a new one has to.
- Shopify validates `range` steps server-side and `theme check` does not:
  `(default - min)` must be divisible by `step`, and `(max - min) / step` must
  be ≤ 101. Audit these after editing any range.

### Schema gotchas

Things `shopify theme check` rejects that are easy to get wrong:

- `theme_info` requires `theme_documentation_url` and `theme_support_email` as
  *valid* URI/email — empty strings fail `ValidJSON`.
- `color_scheme_group` requires all six button roles, including
  `primary_button_border` and `secondary_button_border`.
- Every `<img>` needs `width` and `height` attributes (`ImgWidthAndHeight`),
  even when CSS sizes it absolutely inside an aspect-ratio box.
- Preload assets with the `preload_tag` filter, not a hand-written
  `<link rel="preload">` (`AssetPreload`).
- The `script_tag` filter emits a **parser-blocking** `<script src>`
  (`ParserBlockingScript`). Write the tag out by hand with `async` or `defer`
  instead — but check which. In `templates/gift_card.liquid`, Shopify's stock
  markup ships two through `script_tag`, and they need different answers:
  `defer` makes Modernizr's bundle throw *"Cannot read properties of undefined
  (reading 'documentElement')"* from its own init, while `async` behaves
  exactly as the stock loading does (it exposes no global and sets no `<html>`
  classes either way). `vendor/qrcode.js` takes `defer` because the inline QR
  block needs it in order — and that block then has to wait for
  `DOMContentLoaded`, since deferred scripts run before it but after parse.
- **Filters cannot be used on `{% render %}` arguments**
  (`UnsupportedFilterArguments`). `{% render 'x', title: a.b | escape %}` is an
  error — `{% assign t = a.b | escape %}` first, then pass `t`.

### Templates

Every storefront route is treated as a production surface. JSON templates own
section composition. Shopify emits policy markup directly through
`content_for_layout`; `theme.liquid` wraps that platform output with the
design's legal-page scaffold — see "`policy` is the platform exception" under
Content and utility templates. Product, featured product, and quick
view keep separate shells but one Product component contract. Search and cart
support their configured page/drawer/menu surfaces without forking product
cards or recommendation markup.
