# Veylin — provenance and third-party notices

A record of what this theme contains that did not originate in it, and what it
deliberately does not contain. Kept because a Theme Store review asks, and
because the answers stop being obvious once the code is a year old.

## Bundled fonts

Italiana and Karla ship as `.woff2` in `assets/`, both under the SIL Open Font
License 1.1. The full licence and the copyright holders are in
`assets/FONT-LICENSE.txt`, which must travel with the font files.

## The emblem

There is none. The theme carries no brand emblem or monogram: every wordmark
surface renders the merchant's Huge Text letters and nothing else.

Two marks existed here once and both are deleted. `wordmark-mark.png`,
`wordmark-mark-dark.png` and `wordmark-mark-white.png` **were a real
jeweller's logo** — they arrived with the design work this theme grew out of,
and an earlier pass renamed them from `glorious-mark-*`, which changed the
filename and not the artwork. A theme offered for sale cannot carry another
business's mark, so they were deleted rather than merely unreferenced. An
inline-SVG lozenge drawn for this theme replaced them and stood in for the
first repeated letter of the nav wordmark; that substitution was then removed
as a feature — a monogram is not part of this brand — and the SVG, its
`wordmark-mark` snippet and its icon-library entry went with it.

Wordmark text is not a theme setting: the global Huge Text block supplies each
value in Header, Hero, Footer and any merchant-composed placement.

## Originality

Veylin's section and block model is derived from what its own design composes —
the row carousel, the lookbook stage and its timed points, the LQIP media
contract, the detail row, the eyebrow/heading/lede stack, the four button
variants. It is **not** derived from Shopify's reference themes.

Specifically, and deliberately, **not taken from Horizon**: its block type
names, its per-section block catalogues, its logical spacing property names
(`padding-block-start` and friends — this theme keeps `padding_top` /
`padding_bottom`), and its `@theme` catch-all in section `blocks` arrays. Veylin
lists block types explicitly, per section.

What *is* shared with every Online Store 2.0 theme is the platform itself:
theme blocks, `{% content_for %}`, section groups, the settings schema, the
`t:` locale convention, `@app` blocks. Those are Shopify's, not any theme's.

## Design source

The visual design originates in a commissioned redesign export ("Glorious
Jewelers redesign", revision 14). Its measurements, type scale, colour
constants and motion curves are reproduced throughout, which is intentional and
documented in `CLAUDE.md`.

**Whether that design is the author's to resell is a question for the author,
not something this file can settle.** It is recorded here so it is not
forgotten.

Deliberately not ported from that export: `gj-variants.js` (a client-side price
simulator that would disagree with what checkout charges), `search-index.js`
(replaced by Shopify's Predictive Search API), `gj-facets.js`, the 3D ring
viewer, and its checkout page — Shopify hosts checkout, and customising it
needs Checkout Extensibility.

## Demo content

The photography in `assets/` is the original shop's and is **not** cleared for
redistribution. It is present for local development only and must be replaced
or removed before the theme is packaged — see the note on package weight under
the performance work.
