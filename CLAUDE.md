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
| `spec-row.liquid` | craft's `spec` and visit's `detail` | craft, visit |
| `wordmark-mark.liquid` | three PNG cuts | the lockup |

- **`.spec-row:last-child` draws the closing hairline, so every caller keeps
  its rows in a wrapper of their own.** Rendered flat beside anything else — a
  buttons block, say — the last row stops being the last child, the group loses
  its bottom rule and whatever follows gains one. craft keeps them in
  `.measure` and visit in a plain `div`. Verified after the collapse: both
  wrappers hold only `.spec-row` children, and the 1px border lands on row 4 of
  4 and row 2 of 2 respectively.
- **The hero is not a caller of either, deliberately.** `.hero__choice` looks
  like a labelled row and is not one, and `.hero__cta` is not a `.btn`. The
  hero is art-directed against a fixed viewport height with its own `--hero-*`
  literals; sharing a component with it would mean either the hero drifts or
  the component grows a hero-shaped exception. Same reason its button settings
  were added and then reverted.
- **A filter cannot be used on a `render` argument**, so every caller that
  needs to know whether a link is off-site computes `link contains '://'` into
  a variable first and passes that. `button.liquid` and `spec-row.liquid` both
  take `new_tab` rather than working it out themselves, because a merchant's
  absolute URL to their own domain should not open a new tab.

### Headings

**The homepage had no `<h1>`, and four of its section titles were not headings
at all.** Measured before the fix: `h1: 0`, and Most Loved, Our Products, Our
Promises and About Us each rendered `<div class="display">`. The only real
headings below them were the five `<h3>` promise cards — so the document's
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

- **The level is a merchant setting**, on `blocks/title.liquid` and on the
  three sections that render `.display` from a section setting — h1 / h2 / h3 /
  not-a-heading, defaulting to h2. A Liquid guard rejects anything else rather
  than interpolating an arbitrary tag name.

  `"tag": null` on the title block still holds and matters more than before:
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

- **The brand palette is emitted at `:root` from two schemes**, not from seven
  new colour pickers. `--c-porcelain`, `--c-ink` and `--c-gold` come from the
  **page scheme**; `--c-noir`, `--c-noir-surface`, `--c-ivory` and
  `--c-champagne` from whichever scheme is nominated the **dark** one. So there
  is still one place each colour is defined, and restyling a scheme restyles
  every surface built from it.

  The mapping was already exact — `scheme_2` *is* the design's noir palette
  (`#0d0c0a` background, `#14110d` surface, `#efe9dc` text, `#c7a15c` accent),
  so the literals were re-typing a scheme that existed. `--c-ivory` was already
  being declared twice as a component-scoped literal, which is this idea
  arrived at by hand.

- **Two routes, and which one a component takes is a real distinction.** A
  component inside a section follows that section's scheme — the lookbook is
  inside `.scheme-scheme_2` and its background is that scheme's `--c-bg`. A
  component that is dark *regardless* of the page cannot use `--c-bg` at all,
  because it may sit in a light section; those use the brand tokens. Verified
  on the page: recolouring the lookbook's scheme moves the lookbook and not the
  nav overlay, and recolouring `--c-noir` moves the nav overlay and not the
  lookbook. Both are correct.

- **`--c-noir-deep` is derived, not stored.** The design states `#0B0A08`
  against its `#0D0C0A` for the veil behind a dark panel;
  `color-mix(in srgb, var(--c-noir) 88%, #000)` follows the merchant's noir
  instead of drifting away from it.

- **The page's own scheme is a setting.** `layout/theme.liquid` hardcoded
  `class="scheme-scheme_1"`, so a merchant could define four schemes and never
  choose which the page itself used — every section restyleable and the ground
  under them not.

- **The scrollbar colours are settings but deliberately still not per-scheme.**
  The reasoning under "Scrollbars" stands: one design file serves the noir home
  page and the porcelain inner pages and paints the identical thumb on both.
  Being a literal and being un-styleable are different problems; this fixes the
  second without giving up the first.

- **`#FFFFFF` behind a product thumbnail is `--c-surface` now.** The
  photography is shot on white and the backdrop should match the merchant's
  surface rather than assume it.

Two traps, both hit here:

- **Replacing `#EFE9DC` with `var(--c-ivory)` across the file turned
  `--c-ivory: #EFE9DC` into `--c-ivory: var(--c-ivory)`** — a self-reference,
  which CSS treats as invalid at computed-value time and drops entirely. A
  blanket literal-to-token sweep has to skip the declarations *of* those
  tokens.
- **A `str.replace` whose anchor does not match fails silently.** Four settings
  were "added" to `config/settings_schema.json` by a script that printed
  success and changed nothing, because the anchor assumed an indentation the
  file does not use. `veylin-lint`'s R06 caught it — `settings.page_scheme` was
  referenced in Liquid and defined nowhere — where `theme check` returned `[]`,
  since it does not read that file.

### Buttons

**The design's four variants, chosen per button.** `snippets/button.liquid`
renders every one; the four `buttons` blocks — hero, craft, about, visit — used
to write their own markup and *hardcode* which variant they emitted, so a
merchant could change the words and the destination and nothing else.

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
- **Size and radius are inline custom properties, not classes.** `.btn` reads
  `var(--btn-radius, var(--button-radius))`, so a button given neither renders
  byte-identically to before the snippet existed. That is what makes the
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

### Text alignment

**Two levels, and the block wins.** A section carries `content_alignment` and
its text blocks follow; a block carries its own `alignment`, defaulting to
`inherit`, and overrides the section when set.

- **The section publishes a custom property; it does not wrap anything.**
  `--section-align` and `--section-align-jc` go on the section root, and
  `.display` / `.section-lede` / `.section-eyebrow` read them as their default.
  A wrapper was the obvious approach and is wrong twice over: `.align-*`
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
  `promises`, `testimonials`, and `rich-text`, which had its own `alignment`
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
Current revision: **14** (2026-08-11), the **facets release**. Checked file by
file against 13: **no `.dc.html` changed at all**, so nothing already ported
needs re-examining. It adds `gj-facets.js`, wired into All Products and Search
only, and gives `gj-variants.js`'s price filter a karat-pinning argument
(`range(id, base, purity)` — "what would these cost in 14k"). Both land in
templates this theme has not built yet, so neither is ported.

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

Brand constants taken from it: porcelain `#F4F0E8`, ink `#191510`, noir
`#0D0C0A`, ivory `#EFE9DC`, champagne `#C7A15C` (on dark), deep gold
`#9A7836` (on light), error `#A2422C`. Italiana display + Karla body.
Square corners on cards and imagery, pill CTAs, letterspaced uppercase
micro-labels.

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

- **The shop states its address, telephone and email once.** They are theme
  settings — `shop_address`, `shop_address_link`, `shop_phone`, `shop_email`
  under "Shop details" — because the same three facts appear in the menu
  overlay, the footer's salon column and the Visit section, and a shop that
  moves should have one place to say so. They were duplicated across a header
  setting, a footer block and a `templates/index.json` block before, so the
  address was stored four times and the map link three.

  Consequences worth knowing:
  - **No literal address, telephone, email or map URL belongs outside
    `config/`.** `grep -rn "MacArthur\|maps/place" --include=*.liquid
    --include=*.json . | grep -v ^./config/` should come back empty.
  - `shop_address_link` lives in `settings_data.json`, not as a schema default.
    Shopify's `url` setting type takes no `default`, so the shipped value has
    to be stored rather than declared — which is why the other three carry both
    a schema default *and* a stored value.
  - The Visit section's detail row has a **`source`** select: `custom` uses the
    block's own label/value/link, and `address` / `phone` / `email` take the
    value from the theme settings and build their own `tel:` / `mailto:`. Only
    the label stays the merchant's, so "Address" can still read "Find us". A
    row whose resolved value is blank renders nothing rather than an empty rule.
  - `tel:` hrefs strip spaces, dashes and parentheses at each call site
    (`+1 (555) 010-9988` → `tel:+15550109988`). A `{% render %}` snippet cannot
    hand a value back to its caller, so this is one filter chain repeated in two
    places rather than shared.
  - Visit's "Get Directions" falls back to `shop_address_link` when its own
    button link is empty, which is why `templates/index.json` no longer stores
    a map URL.
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
  `#craft`, Contact Us → the contact page. Contact Us instead falls back to
  `mailto:` the shop email, as asked; setting its link overrides that.
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
- Section padding goes through `snippets/section-style.liquid`, which resolves a
  **named step** to the design's own clamp — see "Spacing steps" below.
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
- **The list column sticks beside the stage.** `.lookbook__list-inner` is
  `position: sticky; top: 86px` above 61.25rem (980px), the design's own
  `listPos: wide && listOn ? 'sticky' : 'static'` with `listTop: '86px'` and
  `wide = w >= 980`. Below that it is static and the grid drops to one column,
  as the design does.

  It shipped not sticking, and **the rule was never the problem** — it computed
  correctly with 326px of room. `overflow-x: hidden` on `html` and on `body`
  had made both scroll containers. See "Things that cost time once".
- `width: min(100%, 62vh)` on `.lookbook__main` **is the design's own** (its
  stage column is `<div style="min-width:0;width:min(100%,62vh)">`), so the
  stage measuring narrower than the 560px track on a short viewport is correct,
  not a porting error. Do not "fix" it to fill the column.

### Homepage sections

`hero`, `featured-products` (Most Loved), `collection-list` (Our Products),
`lookbook` (Shop the look), `promises`, `craft`, `about`, `testimonials`,
`visit` — plus `header`,
`announcement-bar`, `cart-drawer`, `newsletter-popup`, `cookie-banner` in the
header group, `footer` in the footer group, and general-purpose `rich-text`
and `newsletter`. `predictive-search` and `quick-view` are sections with **no
schema**: a merchant never places either, they only answer a fetch — the
search-suggest endpoint, and `?section_id=quick-view` on a product URL.

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
  static-only, so there is no way to wrap a subset. A Title block and a card
  could therefore never share a section with a moving track. Rendering the card
  from the section's own loop sidesteps that entirely: the section still wraps
  each card in `.row-carousel__cell`, and `snippets/row-carousel.liquid` is
  untouched.

  **The loop is written twice, deliberately.** Only the carousel path captures
  its cells, because the carousel snippet takes markup; the grid — the default —
  renders inline so it cannot depend on `{% content_for %}` surviving a
  `{% capture %}`. Keep the two the same.
- **The card is a grid of named areas, not a flex column**, and that is what
  makes the design's arrangement independent of block order. Each part claims
  its area (`title`, `count`, `rule`, `media`), so dragging the count above the
  title in the editor cannot move it out of the head row, and removing a part
  leaves the rest where they were. This is the "fixed structure, blocks toggle
  parts" reading, chosen over full composability on request.

  The photograph and the hover band **share the `media` area**. That is how the
  band covers the photograph exactly while staying its *sibling*, which is what
  lets either be removed on its own — so the band states its own `z-index`
  rather than relying on document order, and repeats the photograph's 16px
  margin so the two boxes coincide.

  Verified against the flex card it replaces, at a 439px column: card 439×637,
  title text at (35,21), the 0.7em arrow at (189,30), the count at (387,39),
  the rule at (35,73)×369, the media at (1,90) 437×547, the band and its row
  identical. Every measured value matches.
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
  when the paragraph block became its second caller — same values, so the
  lookbook is untouched but for the class name.
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
  The shipped pattern for that is `type_ratio_min`/`type_ratio_max`: a `select`
  whose values are numeric strings, coerced with `| times: 1.0`.

- **The recorded `range` audit one-liner is blind to a range and must not be
  trusted as written.** Its regex cannot cross a brace, and
  `featured-products`' `products_to_show` carries
  `"visible_if": "{{ section.settings.limit_products }}"` — the `{{ }}` breaks
  the character class and that range is skipped silently. Parse the schema
  block instead (`{%- schema -%}(.*?){%- endschema -%}` → `json.loads` →
  recursive walk); that form finds all of them. 51 ranges remain.

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
  back to anything. `type_ratio_min`/`type_ratio_max` are the shipped
  precedent — selects of numeric strings coerced with `| times: 1.0`.
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

**Still not split: the keyframes.** The design's second-commonest curve,
`cubic-bezier(.19,1,.22,1)` at 54 uses, is its animation easing and appears
**once** here (`base.css:925`). `base.css` still carries ~25 `animation:` lines
on a bare `ease` and ~40 hand-written durations. That is the next motion pass;
it needs the same per-declaration care rather than a sweep.

### Block spacing

Five presets — Tiny, Small, Medium, Large, Extra large — offered by a theme
block for its margin, padding and gap, from `snippets/block-spacing.liquid`:

```liquid
style="{% render 'block-spacing', margin: block.settings.margin, padding: block.settings.padding %}"
```

- **The steps are aliases, not new numbers.** `--step-tiny` … `--step-xlarge`
  at `:root` resolve to `--space-2xs / sm / md / lg / xl`, so a block cannot
  introduce a gap the theme's own scale does not already contain. They are
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

A 1:1 rebuild of `Product Card.dc.html`, in `snippets/product-card.liquid`.
Used by Most Loved, the collection template and the search template.

- **The design's card is one `<a>` with buttons nested inside it**, which is
  neither valid HTML nor navigable. Here the title carries the only link and
  its `::after` covers the card, so the media and the caption open the piece
  while the controls sit above that layer. **Anything inside the card that
  must stay clickable needs a `z-index` of its own** — the add button
  included, because a static element paints *below* a positioned one whatever
  the document order.

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
  - **The selected ring is `--c-surface`, not `--c-bg`.** The design's
    `0 0 0 2px #ffffff, 0 0 0 3px #191510` is a gap in the *card's* colour; on
    the page background it reads as a porcelain halo. It is two shadows and not
    a border because a border would consume the dot's width and shift every
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
- **`data-card-multi` is gated on the photograph count, not the slide count.**
  It drives only the no-JavaScript hover swap, and that swap can reveal only a
  photograph — `base.css` excludes a spin from it, a spin having nothing to
  show until its source is fetched. Gated on slides, a piece with **one
  photograph and a spin** faded its only photograph out on hover and revealed
  nothing. The arrows are a separate question and stay on the slide count,
  since the script steps to a spin perfectly well.
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

A 1:1 rebuild of `Quick View.dc.html`. Three files, following the search
overlay's shape exactly:

- `snippets/quick-view.liquid` — the empty shell, rendered by
  `sections/header.liquid` into the header group.
- `sections/quick-view.liquid` — **schema-less, like `predictive-search`**. A
  merchant never places it; it only answers
  `<product url>?section_id=quick-view`. Because that request is made against
  the product's own URL, `product` inside it is the real product object, so
  money, translation and image sizing never leave Liquid.
- `snippets/quick-view-contents.liquid` — the panel itself.

The panel's contents are replaced wholesale on every open, so **every handler
is delegated from the document**; one bound inside the panel would be pointing
at detached markup by the second piece. Responses are cached per URL.

- **The overlay opens on the click, not on the response**, so the piece is
  never a wait with nothing on screen. The trigger was a real link to the
  product before the script touched it and goes back to being one if the
  request fails.
- **The entrance is held until the piece lands, and there is no panel surface
  around the wait.** Every entrance value is already exact to the design —
  `gj-modal-in` is `gjModal` keyframe for keyframe at `.45s
  cubic-bezier(.22,1,.36,1) both`, the veil is `gjFadeIn .3s ease both`, and the
  geometry (1300px, 94vh, z-index 250, veil at 62% and `blur(8px)`) matches. The
  defect was *when* it played: an empty loading box was visible at its intrinsic
  size, then became the much larger two-column panel when the response arrived.
  Its height is set by the info column and varies by piece, so guessing a
  placeholder size merely moves the jump.

  `.quick-view.is-loading` is therefore a transparent, content-sized carrier
  for the diamond, with the close control fixed at the overlay corner. Dropping
  the class flips `animation-name` from `gj-fade-in` to `gj-modal-in`, which
  restarts it at time 0 — the first visible panel has its real geometry and its
  product already in it. The cached and fetched paths both converge on that one
  entrance.

  **The specificity is load-bearing.** `.overlay.is-closing .quick-view` (0,3,0)
  still outranks `.quick-view.is-loading` (0,2,0), so closing mid-fetch plays
  the exit — checked in both states. And do **not** move the entrance onto
  `.quick-view__contents`: the panel's own animation would still restart when
  the class drops, compounding to `translateY(36px) scale(0.970)`, and
  `.quick-view__close` is a sibling of the contents so it would fall out of an
  entrance the design includes.
- **`.overlay`'s padding floor is 10px, not 9.6px.** The design states
  `clamp(10px,3vw,40px)`; `0.6rem` was 9.6px. Shared with the newsletter popup
  deliberately — its design file states the same clamp — so the correction
  belongs on `.overlay`, not on `.overlay--quick`.
- **The gallery slides where the card cross-fades** — one track translated by
  whole slots. Double-click zooms to 2.2× at the point clicked, with drag,
  pinch, ctrl-wheel and the design's minimap. Changing slide resets the zoom.
- **What scrolls in two columns is one setting of three — `quick_view_scroll` —
  because the three are alternatives.**

  - `panel` is the design's own: the modal is `max-height:94vh;overflow:auto`
    and everything in it moves together. It carries no class.
  - `media` caps the gallery to the panel's visible block size and keeps it
    sticky there while the taller details column scrolls the panel past it, so
    the gallery never inherits that column's height. Its width still fills the
    left grid track.
  - `details` is the **default and a departure made on request**: the panel
    itself stops scrolling and only the middle of the details column moves.

  It is a select rather than a second checkbox because two would offer four
  combinations of which one is meaningless — with only the details scrolling
  the panel does not scroll at all, so the gallery is capped to it by
  construction and there is nothing left for a "keep it pinned" to do, and
  nothing to be sticky against. Same rule the tax note is written to: "is it
  on?" has exactly one answer. The two-column trigger in all three is the
  `.quick-view__contents` container at 52.5rem, not a viewport guess; below it
  the panel scrolls as a whole whichever is chosen.
- **`details` pins the name, the price, Add to Bag, the reassurance line and
  View full details. The axes and the specification are what scroll.**
  `.quick-view__details` wraps that middle and is `display: contents` under the
  other two modes, so it changes no geometry there whatever.

  **It is gated on `min-height: 40rem` as well as on the container's width, and
  that gate is not optional.** The pinned rows and the bar are a fixed cost —
  measured, 290px of rows at 1280 wide, 312 at the narrowest two-column width,
  about 46 more for a title that wraps, and a 74px bar — and the scroller is
  only what is left. Where that remainder reaches zero the scroller collapses,
  and **a zero-height scrollport shows nothing however much it holds**: every
  axis and the whole specification would be invisible, with the panel no longer
  scrolling to compensate. Measured at **932×430 — an iPhone Pro Max in
  landscape, not a contrived window** — the container is 876px so two columns
  fired and `.quick-view__details` came out **0px tall holding 823px**. It
  shipped that way for one revision of this change and a review pass caught it;
  the verification that missed it had checked that Add to Bag was reachable,
  which it was, and never asked whether the axes were.

  Below the gate the panel scrolls as a whole, which is `panel`'s behaviour and
  known good. Just above it, at 1280×648, the region measures 163px against
  823px of content — small but real, and never zero. It is a *media* query
  because the arrangement depends on block size, which a container query cannot
  ask: `container-type: size` needs a height independent of contents, and the
  panel's is not.

  Seven things are load-bearing, each documented beside its rule in `base.css`:

  - **`.quick-view__frame`.** The column of exactly the panel's visible height
    has to be a *descendant* of the element carrying `container-type`, never
    that element itself — the `.row-carousel__frame` trap, hit again here. On
    `.quick-view__contents` it parses, uploads and never fires; measurement is
    what caught it, since every rule on a descendant applied and that one did
    not. It is also what keeps the loading state safe: `theme.js` empties the
    contents before adding `is-loading`, so the frame does not exist while the
    diamond is on screen and no empty box can be given a screen of height.
  - **`grid-template-rows: minmax(0, 1fr)`**, or the implicit `auto` row sizes
    to its content first and a long details column grows it past the panel,
    carrying View full details off the bottom of the screen.
  - **`flex: 0 1 auto` on the scroller** — it shrinks but never grows, which is
    what keeps `justify-content: center` meaningful.
  - **`flex: none` on everything else in the column**, or the pinned rows give
    way alongside the scroller and it is the title that shrinks. The scroller
    beats that rule on specificity, (0,3,0) against (0,2,0), not on source
    order, so neither can be moved and quietly lose.
  - **The column keeps an `auto` overflow of its own** for the band the height
    gate cannot reach — a title wrapping to three lines just past 40rem, say —
    **and `justify-content: safe center` is what makes that reachable.** A
    centred flex column splits its overflow across *both* ends and `scrollTop`
    clamps at 0, so the start-side half is clipped away from every input. That
    is the classic centred-overflow trap and it had shipped here: at 1280×400
    the eyebrow sat 23px above the scroll origin with no way to reach it.
    `safe` falls back to `start` exactly when the column overflows and is plain
    `center` when it does not, so short-piece geometry is untouched.
  - **The scroller grows sideways and is pulled back by the same amount**, so
    the rows keep the width and x they have in every other mode. Two things
    need that room: the focus ring, which reaches 5px out (`:focus-visible` is
    a 2px stroke at a 3px offset) against the 2px a control sits inside the
    region, and the scrollbar, which is subtracted from the content box and
    would otherwise narrow every row by 11px and crowd the values against it.
    The end margin gives back the ring's reach, 6px of air *and*
    `--scrollbar-size`, derived from the token rather than typed. 22px in all,
    against a column padding of at least 33.6px wherever two columns fit.
    **`scrollbar-gutter: stable` is what keeps that honest** — the margin is
    unconditional and a scrollbar is not, so without it a piece whose details
    do not overflow would have its rows hanging 11px into the padding. It is
    the one place in this theme the property belongs; the global note under
    "Scrollbars" rules it out on `html`, where it would break theme.js's live
    measurement, and nothing measures this one.
  - **The panel keeps `overflow: auto`**, not `hidden`, so anything that does
    overflow stays reachable rather than clipped.

  **The region is a tab stop only when it actually scrolls, and `theme.js`
  decides that by measuring.** A scroll container has to be reachable by
  keyboard and nothing gives this one that for free: it holds focusable
  children, which is exactly the case where Chrome's keyboard-focusable-
  scrollers behaviour declines to add it to the tab order, and no other engine
  adds it either. Tabbing its own controls is not a substitute — the
  specification sits after every one of them, and each `<select>` axis eats the
  arrow keys to change the variant, so the tail of the region was mouse-only.
  `syncQuickDetails()` sets `tabindex`, `role` and the label when
  `scrollHeight > clientHeight`, and takes all three off when it does not: a
  stray tab stop on a region that cannot move is worse than none. Under the
  other two modes the wrapper is `display: contents` and has no box, so both
  values read 0 and the test is false by construction. It runs on fill and on
  resize, since both thresholds it depends on move with the window.

  Measured at 1280×900 against a six-axis piece: the panel is 823px and does
  not scroll, the gallery is 748 (823 less the 75px bar), the details region
  scrolls 406px, and the title, the price, Add to Bag, the bar and the gallery
  all move **0**. A short piece's stack is *pixel-identical* to `panel` mode —
  title at 247, Add to Bag at 523 in both — because the scroller only shrinks
  and the column stays centred. A row measures 499.01px wide and 1.71px inside
  the column whether the region scrolls or not, with 11px of air to the bar.

  **The panel surface is always the full visible height here**, though, where
  `panel` shrink-wraps a short piece to 715. That is the fixed frame height,
  and it is the same thing `media` does (which is always 823 for any piece);
  the stack inside lands on the same screen position either way, so what
  changes is the porcelain around it. It cannot be given up without giving up
  the gallery's minimum too: the gallery's `min-block-size: 0` is what lets it
  take the row's height, so a shrink-wrapping frame would let a short piece
  squeeze the well below the design's own floor.

  At 420px wide every mode is identical: one column, both wrappers inert, the
  panel scrolling. At 932×430 and at 1280×400 the height gate hands over to
  that same whole-panel scroll, and every axis and spec row is reachable again.
- Clarity, colour and certification are **theme settings** with the design's
  values as defaults, and the matching `custom.diamond_clarity_grade` /
  `custom.diamond_color_grade` / `custom.certification_lab` product metafield
  in front of each. `custom.spin_360_video` similarly overrides the first
  product-media video in the gallery. Beside them sits the design's **Total
  carat weight** row, from the same `custom.total_carat_weight` the card's
  caption reads.
- **The axes are the product's options, one row each** — revision 13's variant
  release. A rule, the option's name at the left, the chosen value at the right,
  and the control beneath. This replaced a `<select name="id">` listing every
  variant, which was neither the design's nor usable.

  **Which control an axis gets is derived, not tabled.** The design fixes each
  `kind` by hand because it owns its own axis table (`axisDefs`); here they are
  the merchant's options, so: the metal — or any option whose values carry a
  native Shopify swatch — is painted with swatches; three values or fewer is a
  row of pills; more is a select. That reproduces the design's own arrangement
  on the design's own data (karat, origin, cut, purchase option, backing and
  clasp are pills at two and three values; ring size at thirteen, chain at five
  and wrist at four are selects). **Never add a table of option names here** —
  the same rule `metal-swatch.liquid` is written to.

  **The metal row always leads, and the metal only.** The design's `axisDefs()`
  opens with `out.push({ key: 'metal', … kind: 'swatch' })` and pushes the rest
  after it. Rendering `options_with_values` in its own order gave whatever the
  merchant typed in admin, which put "Gold Karat" above "Metal" on this shop.
  Hoisting *every* swatch-kind option instead would make row order depend on
  admin metafield data — connect the Color metafield to a "Finish" option and
  the panel silently reorders, and if it sits before Metal it would lead, which
  the design never does. `gj-variants.js` has exactly one `kind: 'swatch'`, so
  the design states no precedence between two and inventing one is not porting.
  Everything after the metal keeps the merchant's order.

  **The positions are never renumbered.** `option_order` is a list of *original*
  indices and the row loop does `assign opt_index = position | plus: 0` — the
  `| plus: 0` is not optional, since `split` yields strings and
  `options_with_values["1"]` is nil. `data-qv-group`, `data-qv-prefix`,
  `data-qv-pick`, `data-qv-select` and `current_variant.options[…]` share that
  one numbering space, and `theme.js` compares `options[j] !== choice[j]`
  positionally against `variant.options`. Renumber to the display order and
  every multi-option product resolves the wrong variant, or none — and Add to
  Bag then disables itself permanently. Verified after the change: Metal renders
  first carrying `data-qv-group="1"`, Gold Karat second carrying `"0"`, and a
  pick on either still resolves the right variant and price.

  The **metal row's caption composes the karat** — "18K Yellow Gold" — which is
  the design's own `metalName(v)` and matches how a bag line reads
  (`line-options.liquid`). The karat keeps its own row below, as in the design.
  The swatch row is ordered by `snippets/metal-order.liquid`, shared with the
  card, and the selected ring is a 3px gap in `--c-bg` — the *panel's* colour,
  where a card's is `--c-surface`.

  A pick resolves against a variant list Liquid embeds beside the rows, every
  figure in it `money`-formatted, so nothing in the browser formats a price. A
  combination the shop does not make leaves the price standing and says so on
  the button; values stay listed whatever the stock, as the card's note does.
- **Engraving looks like an axis and is a line item property.** Gated on
  `custom.engraving_available`, so it appears only where admin says the piece
  can be engraved. Its input is tied to the form by `form="…"` rather than by
  nesting — the control belongs up in the rows — and stays `disabled` until
  asked for, since a disabled control is not submitted.
- The close button is named `data-overlay-autofocus` deliberately: the veil is
  also a close control and comes first, so without it the overlay opens with
  focus on a full-screen invisible button.

### Scrollbars

A 1:1 port of the design's `gj-scrollbar.css`, at the top of `base.css` under
"Scrollbars". All **24** design pages link that file, so it is a site-wide
theme rather than a component's.

- **The colours are not per-scheme and must not be made so.** The same design
  file serves its noir home page (`html{background:#0D0C0A}`) and its porcelain
  inner pages (`html{background:#F4F0E8}`) and paints the identical thumb on
  both — `#8A8072` is a warm mid grey chosen to read against either end.
  Splitting it per scheme would also split one design colour in two on the
  panels that carry a scheme class *and* scroll, `.quick-view` and
  `.drawer__panel`. They are literals at `:root` rather than settings because
  `theme-tokens.liquid` compiles only settings into `:root`, and a scrollbar is
  not one — the same shape as the `--product-*` properties.
- **The two halves are not equals.** The design puts the standard
  `scrollbar-width`/`scrollbar-color` on `*`, and where an engine honours those
  it may ignore the `::-webkit-scrollbar` rules and take the 11px width, the 3px
  inset, the pill radius and the `#6E6558` hover with them. `#8A8072` paints
  everywhere; the refinements paint only where the pseudo-elements are honoured.
  That asymmetry is the design's own and is kept. Measured in Blink here: both
  halves apply, and **`var()` does resolve inside `::-webkit-scrollbar`** (11px
  bar, `rgb(138,128,114)` thumb, 999px radius), so the tokens need no literal
  fallbacks.
- **`scrollbar-gutter` is deliberately absent.** `theme.js` measures
  `window.innerWidth - html.clientWidth` *before* it sets `overflow: hidden` and
  applies the difference as body padding; a stable gutter would keep that
  measurement non-zero and stack a second gutter's worth of padding on every
  overlay open. `thin` alone is safe — the measurement is live.
- **The design hides some rails, and those must be hidden here too.** It marks
  them `data-rail`, with
  `[data-rail]{scrollbar-width:none}[data-rail]::-webkit-scrollbar{display:none}`.
  Two of its four are ported: `.lookbook__rail`, which already had it, and
  **`.search-overlay__results`, which did not** — its box was ported declaration
  for declaration and the hiding was not, which only became visible once the
  bars were themed. The other two are the filter chip rail on All Products and
  Search, whose templates are not built yet; hide them when they are.
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

**One mark for every wait in the theme**, from `snippets/loader.liquid`: the
quick view while the piece is fetched, the search overlay while a query is in
flight, and whatever waits next. `{% render 'loader', label: text, size: 'sm' %}`
— `sm` / `md` / `lg`, 28 / 44 / 68px, and a label that defaults to
`general.loading`.

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
- It is gold on whatever scheme it lands in — `--c-accent`, which is already
  `#9A7836` on a light panel and the champagne `#C7A15C` on the noir search
  overlay. Under reduced motion the stone is simply drawn whole rather than
  hidden: a wait with no sign of waiting is worse than a still one.
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
  `#F8F5EE` over a `#F4F0E8` footer; the theme had the panel on `--c-surface`,
  which is `#ffffff` in scheme_1, so a two-tone read as white against
  porcelain. It is `color-mix(in srgb, var(--c-surface) 26%, var(--c-bg))`
  rather than the literal, for the reason the quick view's background is a
  token — the drawer's scheme is merchant-selectable and a hardcoded near-white
  panel would carry ivory text on scheme_2. At 26% it lands within one step of
  255 of the design on every channel.
- **The drawer uses three hairline weights and they are the design's, not
  `--c-hairline`.** 12% at the panel edge, under the header and above the
  footer; **10%** between lines; 14% around a thumbnail (which is what
  `--c-hairline` happens to be). The header count and a line's meta are ink at
  **50%**, not `--c-muted`.
- **The footer's two buttons carry their own values, not the `--button-*`
  tokens.** Checkout is champagne `#C7A15C` with `#14110D` on it — the design's
  primary CTA colour, the same one `.quick-view__add` carries as `--qv-gold` —
  turning ink on hover; Salon is an ink hairline at 35%, not the accent. Both
  are 15px/22px, where the global tokens give 16px/28px. `--c-accent` is the
  light-background gold `#9A7836` and is a different colour; do not reach for
  it here.
- The footer's own geometry is stated too — `20px clamp(20px,5vw,30px) 26px`,
  a 16px subtotal figure and a 10px button gap — because the spacing scale
  lands at 18.7/30.08/28.1 with a 19.18px figure.
- **Quantities are never recomputed in the browser.** Every change posts to
  `/cart/change.js` with `sections: <id>` and swaps the re-rendered
  `[data-drawer-contents]` in, so line prices, the subtotal and the item count
  are always Liquid's numbers. The count rides along on a
  `[data-cart-count-value]` element rather than a second request.
- **A press while a change is in flight is held, not dropped.** `cartBusy` used
  to `return` outright, so pressing + three times quickly moved the bag by one.
  Presses inside 220ms now coalesce into one request and anything arriving
  mid-flight is kept as `cartPending` and sent when the line frees. Measured:
  three rapid presses take a line from 3 to 6. A removal flushes immediately
  rather than coalescing — it is the last thing that line will say.

  The **number** under the pointer is written on the press so the control
  answers at once. That is the count, not a price; nothing here does arithmetic
  on money, and the re-render that follows overwrites it.

  `applyCartSection` restores `[data-drawer-scroller]`'s `scrollTop` across the
  swap, or a scrolled list jumps to the top on every step.
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
  press, so it covers the request. Every other line still collapses on its own
  and the rest of the panel never moves. Verified: on the last line the fade is
  running 19ms after the press with no `[data-leaving]`; with two lines it is
  the reverse.

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
  animatable, unlike height) before the line is dropped.
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
  `.drawer-row__meta` and `.drawer-qty__value`, which did not need to before.

### The tax note

"inc. tax" after every price, from `snippets/tax-note.liquid`.

- **One switch, and it is `settings.show_tax_note`** (Theme settings → Pricing).
  Every surface obeys it and none can override it, so "is it on?" has exactly
  one answer. Verified both ways: off gives 0 notes across home, collection,
  product, quick view, predictive search and the drawer; on restores them.

  `featured-products`, `lookbook` and `cart-drawer` each carried a second
  toggle ANDed with it, and `tax-note.liquid` took an `enabled` parameter.
  All four were removed on request — a note qualifying a price is a statement
  about how the shop prices, not a per-row style choice, and three extra
  switches made the shop-wide one hard to trust. **Do not reintroduce a
  section-level toggle.**
- **In the card it goes inside the `metal_price_html` capture**, not after it.
  That capture is what the script writes into `[data-card-price]` on a metal
  pick, so a note left outside would vanish at the first swatch click.
- **In the quick view the note is a *sibling* of the figure**, not part of it —
  `<span data-qv-price>` then the note. A pick rewrites the figure's own text
  node and the note is never touched. The card cannot split them that way, which
  is why it captures instead.
- **`search-row` takes a `tax_note` flag rather than guessing.** Its `meta` is a
  price for a product row but a kind label for a collection, page or article —
  "Page inc. all taxes" would be nonsense.
- The snippet emits a **real leading space**. Callers trim around the render, so
  without it the markup is `$19.99<small>inc. all taxes</small>` — spaced by CSS
  on screen, but one run-together word when read aloud or copied.
- **Two wordings, on request.** `products.tax_note` — "inc. all taxes and fees"
  — everywhere a price has room to be qualified in full. The **product card**
  passes `short: true` and gets `products.tax_note_short`, "inc. all taxes",
  because a card's price line is one row beside the figure at 15px and the
  longer sentence wraps it onto two. Both live in `locales/en.default.json`
  rather than in a setting: "inkl. MwSt." is a localisation, not a per-shop
  style choice.
- Not applied to `templates/gift_card.liquid`, whose figure is a **balance**
  rather than a price.

### Things that cost time once

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
- **The footer accordion opens one row at a time**, as the design does —
  opening a section closes whichever was open. That lives in `initFooter`, not
  in CSS.
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

Everything other than `templates/index.json` is a minimal unstyled placeholder
that exists so the store is browsable. They are not the design and should be
rebuilt as section-based JSON templates when their turn comes.
