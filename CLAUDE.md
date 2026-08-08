# CLAUDE.md

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

Brand constants taken from it: porcelain `#F4F0E8`, ink `#191510`, noir
`#0D0C0A`, ivory `#EFE9DC`, champagne `#C7A15C` (on dark), deep gold
`#9A7836` (on light), error `#A2422C`. Italiana display + Karla body.
Square corners on cards and imagery, pill CTAs, letterspaced uppercase
micro-labels.

### Not ported

Still out of scope, all present in the design: quick view, the 3D ring viewer
(`ring3d.js`, `three-d-stage.js`), and the image-slot placeholders. The
design's **checkout page cannot become a theme template** — Shopify hosts
checkout; customising it needs Checkout Extensibility (Plus for
`checkout.liquid`).

The design's **client-side search index (`search-index.js`) is deliberately
not ported.** Its job is done by Shopify's Predictive Search API instead —
see the search overlay below.

### Conventions

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

  The source design instructs mobile-first authoring with `min-width` queries.
  This theme is still mobile-first — every unprefixed declaration *is* the
  narrow-screen state, and `clamp()` floors are the mobile values — it just
  reaches for intrinsic mechanisms before breakpoints.

- **The promises grid is art-directed, not auto-fitting.** Three tiers: 2
  columns with an odd last card spanning both; then a **6-column** grid where
  each card spans 2, so the orphan row of two sits in columns 2–5 with half a
  column of air either side; then five single columns. That middle tier exists
  only to centre the orphan — `auto-fit` cannot express it, which is why the
  grid is spelled out. The centring is guarded by
  `:has(> :nth-child(5):last-child)` so it only fires at exactly five cards;
  with six there is no orphan and shifting the fourth would open a hole.

  The thresholds are container queries (50rem / 72.5rem on `.promises`), being
  the design's 860px and 1240px viewports converted to the width the grid
  actually gets inside `.page-width`'s gutters. `.promises` exists purely to be
  that container — an element cannot query its own size.

  The section has **no column setting** on purpose: there is nothing for one
  to act on.
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
- Per-scheme derived colours (`--c-hairline`, `--c-shadow`, `--c-veil`) are
  emitted from each scheme's literal colours inside the scheme class, not from
  `var(--c-text)` in `:root` — custom properties inherit their *computed*
  value, so a `:root` derivation would freeze at the first scheme.
- Section padding goes through `snippets/section-style.liquid`, which eases the
  merchant's desktop figure down to 60% on narrow screens.
- Fonts are self-hosted woff2 in `assets/` (Italiana, Karla — both OFL), with
  `size-adjust` metric-matched fallbacks to avoid layout shift. Turning off
  "Use the bundled Glorious fonts" switches to Shopify's font library, and
  `layout/theme.liquid` emits `font_face` only in that case.

### Lookbook

The design's "Shop the look" — a stage carrying a film or a campaign
photograph, marked with points that open the piece they sit on, and a list of
everything in the look beside it. Sits between Most Loved and Our Products,
as on the design's homepage.

- **Nothing is built in JavaScript.** Every scene's panel, every point, every
  card and every list row is rendered by Liquid; the script only decides what
  is shown. Money, translation and image sizing stay in Liquid, and a visitor
  without scripting still gets the first look and real links to every piece.
- **The design's edit mode is deliberately not ported.** Dragging points into
  place and scrubbing their timing is authoring, not storefront — those are
  block settings here, so the merchant places points in the theme editor.
- Points are **flat numbered settings** (`product_1`, `x_1`, `y_1`, `in_1`,
  `out_1`, …) because Shopify sections cannot nest blocks. Four per scene, the
  design's count; the footer's link columns use the same convention.
- `in`/`out` are seconds and only mean anything on a film — empty means the
  point is always shown. They also place the ticks on the seek bar.
- Like the hero, this section carries the design's literals in its own
  properties rather than the spacing scale: the stage is art-directed against
  the viewport height and the points are percentages of it.

### Homepage sections

`hero`, `featured-products` (Most Loved), `category-grid` (Our Products),
`lookbook` (Shop the look), `promises`, `craft`, `about`, `testimonials`,
`visit` — plus `header`,
`announcement-bar`, `cart-drawer`, `newsletter-popup`, `cookie-banner` in the
header group, `footer` in the footer group, and general-purpose `rich-text`
and `newsletter`. `predictive-search` is a section with **no schema**: it is
never placed by a merchant, it only answers the search-suggest endpoint.

### Hero

A 1:1 rebuild. Three art-directed arrangements at 990px and 1100px (see
"Fluid for continuous values" above), the wordmark letters rising 60ms apart
from `.1s`, and the design's decorative arcs and sparkles as inline SVG.

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

The **piece carousel** shows two at a time out of one collection per metal.
Each `metal` block carries its own label and collection, which is how the
design's White Gold / Yellow Gold switch becomes real product data. The whole
pool is rendered and the carousel picks the visible pair, so stepping never
waits on a request and every piece is a real link without scripting — a
visitor without it simply sees the first pair. Arrows hide themselves when
the pool is too short to cycle.

The hero wordmark carries `data-nav-anchor`, which is what the nav measures
its pill → bar expansion against.

### Navigation

- The nav is **one element in two states**, not two elements. `.nav--pill`
  transitions width, height, offset, radius and padding into the centred pill.
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
  264px pill, so asking the container would wrongly strip it there. The label
  and logo-centring rules are the opposite case — the pill genuinely wants the
  icon treatment, and gets it for free by not matching `@container
  (min-width: 62.5rem)`.
- **The resting state is emitted by Liquid, not added by JavaScript**, so the
  first paint is already correct and a nav that never changes needs no script.
  Only `morph` attaches a scroll listener.
- A section group is shared by every template, so the design's per-page nav is
  **two settings**: `nav_mode_home` (default `morph`) and `nav_mode` for
  everywhere else (default `bar`). The design's own values: home `morph`,
  inner pages `bar`, product page transparent-until-scrolled.
- The nav is its own **query container**. That is what makes the pill work for
  free — at 264px wide the `@container (min-width: 62.5rem)` rules that show
  text labels and centre the logo simply stop matching, so the pill gets the
  icon treatment without any pill-specific overrides.
- Menu rows are **section blocks, not a Shopify linklist**, so the design's
  content ships working without the merchant first building navigation menus.
  Numbering is generated from block order; Bag and Search are appended last.

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

### Overlays

Five layers share one controller in `theme.js`: `menu`, `search`, `cart`,
`newsletter`, `cookie-preferences`. **All five live in the header group** —
they belong to the nav that opens them, not to the footer.

The markup contract:

| attribute | meaning |
| --- | --- |
| `data-overlay="name"` | the root; `hidden` when closed |
| `data-overlay-modal` | locks scroll, traps focus, closes on Escape |
| `data-overlay-close="name"` | any control that dismisses it |
| `data-overlay-open="name"` | any control that opens it |
| `data-storage-key` | opt in to showing itself once per visitor |
| `data-delay` | milliseconds before it does |

- **A full-viewport overlay root must never carry a colour scheme class.** A
  scheme class sets `background-color`, so on a `position: fixed; inset: 0`
  root it paints the whole screen opaque and the veil has nothing left to
  veil. This is exactly why the newsletter and cookie popups did not read as
  overlays. The scheme goes on the *panel* — `.modal`,
  `.cookie-banner__panel`, `.drawer__panel`.
- **Exit timing is read, not hardcoded.** `afterAnimations()` asks the element
  for its running animations (`getAnimations({subtree: true})`, which includes
  CSS transitions) and waits for them, with a timeout only as a backstop. Five
  overlays with five very different exits therefore need no table of magic
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
  (`#9A7836`) onto a near-black surface.

### Search overlay

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

### Bag drawer and the cart setting

- `settings.cart_type` picks **one** of drawer or cart page — they are
  alternatives, never both. The drawer section renders nothing on `page`.
- **Quantities are never recomputed in the browser.** Every change posts to
  `/cart/change.js` with `sections: <id>` and swaps the re-rendered
  `[data-drawer-contents]` in, so line prices, the subtotal and the item count
  are always Liquid's numbers. The count rides along on a
  `[data-cart-count-value]` element rather than a second request.
- Removal collapses the row (`grid-template-rows: 1fr → 0fr`, which *is*
  animatable, unlike height) before the line is dropped.
- The bag action stays an `<a href="/cart">`; JavaScript intercepts it. Same
  for search. Nothing here is load-bearing without scripting.
- Cart handlers are **delegated from the document and bound once**, because
  the theme editor replaces section markup wholesale — a listener bound to the
  drawer element would either stack up or point at detached markup. For the
  same reason `registerOverlay` replaces a registration whose element has left
  the document.

### Things that cost time once

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
- **The footer accordion opens one row at a time**, as the design does —
  opening a section closes whichever was open. That lives in `initFooter`, not
  in CSS.
- **Audit every `range` after touching one.** Shopify validates the two rules
  server-side and `theme check` does not, so a bad step only shows up as
  `Failed to Upload Theme Files` with `default must be a step in the range`.
  This one-liner checks the whole theme at once:

  ```bash
  python3 -c "import json,re,glob;R=[];[R.extend([(p,r) for r in re.findall(r'\{[^{}]*\"type\":\s*\"range\"[^{}]*\}',open(p,encoding='utf-8').read())]) for p in glob.glob('sections/*.liquid')+['config/settings_schema.json']];[print(p,r) for p,r in R if (lambda d:(d.get('default',d.get('min',0))-d.get('min',0))%d.get('step',1) or (d.get('max',0)-d.get('min',0))/d.get('step',1)>101)(json.loads(r))]"
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
- **Filters cannot be used on `{% render %}` arguments**
  (`UnsupportedFilterArguments`). `{% render 'x', title: a.b | escape %}` is an
  error — `{% assign t = a.b | escape %}` first, then pass `t`.

### Templates

Everything other than `templates/index.json` is a minimal unstyled placeholder
that exists so the store is browsable. They are not the design and should be
rebuilt as section-based JSON templates when their turn comes.
