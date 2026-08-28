# Section One logo concepts

Three early identity directions generated for comparison. These are raster concept boards, not
production artwork.

1. **Signal One** — a numeral `1` cut into the `O`; the clearest standalone icon.
2. **Section Frame** — an `SO` monogram organized by a central field/hash line; the strongest
   sports-system direction.
3. **Cutline One** — editorial rules interrupted by a decisive orange `1`; the strongest
   publication/technology direction.

**Signal One was selected as the primary identity.** That decision still holds. How it is *rendered*
changed, and this file is mostly here to stop the old answer being picked back up.

## The interface draws the marks; it does not place them

Nothing in `src/` renders a file from `public/brand/`. The marks are drawn:

- `src/features/brand/wordmark.tsx` — the Section One name, typeset in the display face.
- `src/features/brand/section-mark.tsx` — the Signal One mark, traced from the approved canvas to a
  path and filled with `currentColor`.

Two reasons, and it is worth being precise about which is which.

**The immediate one was a bad asset choice.** The six files at the top of `public/brand/` are PNG
colortype 2 — no alpha channel — so their cream ground is part of the image. The interface pointed
at those, which forced every surface carrying one to be cream too. That is what pinned the edition
masthead to paper and left it cream in dark mode through a full release. The alternates under
`alternates/` *are* alpha-backed (colortype 6), so a transparent mark did exist; the code simply
never used it.

**The durable one is that a raster cannot recolour.** Each edition sets its own chrome, stage, and
graphic ink, in two themes. An alpha PNG fixes the ink at export time, so honouring that would mean
one file per colour per theme and a lookup to choose between them. The traced path takes
`currentColor` and serves all of it from one component. Swapping in `alternates/transparent/` would
have fixed dark mode and left the product unable to draw its own mark in a team's colour.

If a new mark is needed, add a path. See [DESIGN.md](../../DESIGN.md) § Brand assets.

## Archived canvases

Kept as the source of record for the identity decision and as the origin of the traced path. Not
referenced by the application.

- `signal-one-canvas.png` — untouched approved Signal One canvas
- `logo-primary-wordmark.png` — horizontal lockup crop
- `logo-primary-mark.png` — standalone Signal One crop; the path in `section-mark.tsx` was traced
  from this
- `favicon.png` — small-scale mark from the Signal One canvas
- `logo-alternate-section-frame.png` — shortened Section Frame crop
- `section-frame-canvas.png` — untouched approved Section Frame canvas

Colour alternates mirror the same filenames under `public/brand/alternates/` (`orange/`,
`reversed/`, `monochrome/`, `transparent/`), and favicon contrast candidates under
`public/brand/favicon-candidates/`. All of those carry alpha. They are still not what the interface
uses, for the recolouring reason above — but they are the right starting point for anything that
has to leave the app as a file: a press kit, an email header, an app-store listing.

Browser and social artwork is separate and still raster, which is correct — those are file formats
the platform requires, not interface surfaces: `src/app/icon.png` and `src/app/opengraph-image.png`.
