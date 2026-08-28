# Section One design system

This is the shared design contract for every team edition. Extend this system when the product
grows. Do not create a second visual language inside one feature.

## North star

Section One should feel like a Saturday game program rebuilt by a first-rate product team: quick to
scan, specific about football, spatial when the game calls for it, and worth opening before kickoff.

The rule is **all signal, no noise**. Every element must help a fan answer one of three questions:

1. What matters this week?
2. What should I watch during the game?
3. What supports that read?

## Visual signature

The genre is an **editorial sports briefing**, not a dashboard and not a newspaper costume. Its
production shape combines three ideas with clear ownership:

- **The Desk** is the shell: a split editorial studio with one dominant game object and a restrained
  reading grid.
- **Field Geometry** is the signature interaction: routes, field lines, and matchup relationships
  carry meaning in the Matchup view.
- **Saturday Edition** supplies the weekly issue line, folios, and sense of publication cadence.

- A restrained team-derived chrome, one team-coloured stage per view, and a team accent that points
  rather than floods. Chrome and stage are separate roles — see § Chrome and stage are different jobs.
- Condensed display type for the masthead, section heads, matchup, and large figures.
- Plain body type for every sentence a fan must read.
- Mono type only for dates, times, scores, counts, and aligned labels.
- Squared geometry — squared, not sharp. Corners take `--radius-card` or `--radius-input`; the
  previous 2px was effectively a right angle and read as unfinished at card sizes.
- Separation carried by **space and surface rather than by drawn lines**. Boxes are for real
  controls, repeated choices, or a group that spacing alone leaves adrift.
- Dense, aligned rows at wide widths; calm single-column reading on small screens.
- Team color may own one deliberate game surface. Everywhere else it points; it does not flood.
- Field lines, schedule rows, rankings, and clocks are the graphic material. Photography is optional,
  exceptional, and never filler.

## Product shape

The shell holds three views and one question thread. The thread stays put when the fan changes views.

| View | Job | Main content |
| --- | --- | --- |
| **Brief** | Catch up in under a minute. | Countdown, matchup, three keys, short read, question box, next three. |
| **Matchup** | Know what to watch. | Four selectable keys and one focused explanation. |
| **Schedule** | See what is next. | Dates, opponents, kickoff times, TV, and venue. |

The countdown always comes from schedule data. It may show a real number, `Today`, or `TBD`. It is
never decorative.

## Brief canvas

At wide widths, Brief reads as one composed issue rather than a stack of cards.

1. A narrow issue bar names the team, week, conference, and independent status. It carries the same
   chrome as the masthead beneath it, so the header reads as one dark band.
2. The masthead holds the typeset Section One wordmark, navigation, team switcher, and theme control.
   It wears the edition's chrome, not paper, and it follows the theme.
3. The hero is a true half and half. The editorial claim owns the left half and the kickoff field
   object owns the right; both bleed to their own window edge and meet at the centre line. Each half
   is inset by the same amount on all four sides so the content sits *in* its half.
4. “What matters Saturday” uses three numbered rows. “The read” sits beside it as a raised card at
   wide widths, sized to its content, and follows the rows on small screens.
5. “In the field” and “This week” form the issue body: a compact standing rail beside sourced weekly
   reporting on desktop, one reading sequence on mobile.
6. “Tune your signal” is a full-width Ask the Desk band. It has no chat-window framing before the
   first question.
7. “Quick questions” stacks: the label sits above a set of content-sized prompt chips. They are
   buttons and are drawn as such.
8. “Next three” is three cards — side by side on wide screens, stacked on mobile — with the next
   game marked by an accent border.
9. The colophon carries the drawn Section One mark and stays small and factual.

Bands alternate ground as they descend: page, soft surface, page, soft surface. That rhythm is the
section separation; see § Lines are drawn by interaction, not by default.

Two rules govern the weekly sections:

- **Rankings are read from the team outward.** Most teams are unranked, and a national top 25 answers
  nothing for them. The standing line is one line; the list underneath is the ranked opponents on
  that team's own schedule, hardest first. A poll that has not been released says so.
- **We write the takeaway; we do not write the reporting.** Every news item carries its outlet and a
  link out. That link must be an absolute `http(s)` URL, checked by `safeExternalHref` where the
  package is admitted: it is rendered into an `href`, and React puts a `javascript:` URL in an href
  with nothing but a console warning. An item without a usable link is dropped rather than shown
  link-less, because the link is the whole basis on which a fan is asked to believe the summary. The summary is ours and must be checkable against the thing it links to. An item without
  a source is not publishable, and the fixture tests enforce that rather than trusting the author.
- **No outlet owns the list.** Items are graded on impact, echo, and freshness, decayed by age, and
  filled under a cap of two per outlet with at least three distinct outlets and local reporting never
  outnumbered by national. Local beat writers are at practice and know the two-deep; a list national
  coverage dominates is a list about the sport rather than about this team. The full rubric and its
  anchors live in `docs/story-selection.md`.

## Surfaces

There are two, and they must not blur into each other.

| Surface | Route | Job |
| --- | --- | --- |
| **Home** | `/` | Say what Section One is, show a live edition as proof, and take a team request. |
| **Edition** | `/teams/[slug]` | The game-week product for one team. |

The home page shares the tokens, chrome, band rhythm, rule discipline, and voice — and deliberately
not the shape. An edition is a split studio built around a live game object; the home page is an
argument that ends in one action. If the two ever read as the same page, the product and its pitch
have blurred.

Home page rules:

- The masthead wordmark is site identity, not the page heading. The `h1` is the fan promise.
- Every claim about scale is counted from `enabledTeamSlugs`, never written by hand. One edition is
  one edition.
- The edition card renders real config and schedule data. A picture of the product would drift; the
  product itself cannot.
- Anchor targets clear the sticky masthead.
- House colour comes from `houseTheme`, not from a team. Editions may ship in any hue; the home page
  does not follow them.
- One exception, bounded to the edition card: the card may carry its own edition's accent on the
  countdown figure and its hover border. Everything outside the card border stays house. A fan
  should be able to see that editions are coloured for their team without the page changing colour
  when a new one ships.
- **The edition card is a card like every other card**: hairline border, card radius, surface
  ground, and nothing else. It used to wear a bled accent hairline along its top edge, which sat
  square against the rounded corner and read as a rendering artefact — the same fault that removed
  the compact schedule row's inset bar. The accent moved to the figure, which carries the colour
  without adding a shape no other card has.
- **The home page borrows the signature, not the stage.** It carries one piece of Field Geometry —
  a ruled field and a route that resolves into the Section One mark — drawn on paper in the page's
  own border and accent roles. It does not get a bold colour field; that is what would make it look
  like an edition. The graphic appears only from 60rem up, because below that the hero is a reading
  sequence and the drawing would sit between the promise and the two actions.

## Masthead

The masthead is the product's frame: the edition's chrome, carrying the house name.

- The issue bar and the masthead share one chrome colour and read as a single dark band. The bar
  carries team, week, conference, and independent status.
- Wide: wordmark, three-view navigation, and controls share one line.
- Medium and small: wordmark and controls lead; navigation moves to its own line.
- The brand line is always “All signal. No noise.”
- **The edition colours the masthead; it never renames it.** The chrome takes the team's structural
  hue at a restrained chroma and the accent letter follows the edition, but the name, the layout,
  and the tagline are the same on every edition. An earlier rule pinned this surface to a fixed
  paper colour to keep editions from recolouring it, which also kept it cream in dark mode —
  edition-invariant is not the same as fixed.
- No official team logo belongs in the masthead.

### Brand assets

Brand marks are drawn in the interface, not placed as pictures.

- The wordmark is typeset in the display face by `features/brand/wordmark.tsx`. The name stays
  constant; only the accent letter follows the edition.
- The mark is the traced path in `features/brand/section-mark.tsx`. It fills with `currentColor`,
  so it can take the chrome's ink in the colophon or the field's ink on the stage, in either theme.
- Give every mark clear space. One mark per surface is enough, and on the stage it stays small and
  cornered — the figure is what that panel is for.

Nothing in `src/` renders a file from `public/brand/`, and that is deliberate.

The six rasters at the top of `public/brand/` have **no alpha channel** — their cream ground is part
of the image — so placing one forces a cream tile onto whatever is beneath it. That is what pinned
the masthead to paper and broke dark mode for a full release. Do not reintroduce them, and do not
solve the tile by drawing a badge around it.

The alternates under `public/brand/alternates/` *do* carry alpha, so transparency was never the
blocker; using the wrong file was. But an alpha PNG still fixes its ink at export time, and this
product needs the mark in each edition's chrome, stage, and graphic ink across two themes. A path
filled with `currentColor` serves all of that from one component. If a new mark is needed, add a
path, not a PNG — including a transparent one.

## View compositions

### Matchup

Matchup is the Field Geometry view. Four keys sit around one selected read on a ruled game surface.
The field is explanatory structure, not a decorative green rectangle.

- At wide widths, the selected read occupies the middle channel and the four keys establish spatial
  comparison around it.
- On mobile, the same keys become a 2×2 picker followed immediately by the selected read.
- A key exposes state, number, title, cue, and selection without relying on color alone.
- “Ask about this” moves the selected prompt into the persistent question composer.

### Schedule

The full Schedule view is a season file, not twelve repeated cards: one tabular spec sheet with a
game number, date, opponent, venue, kickoff, and network. Dates and broadcast windows stay legible
when the row collapses on mobile.

“Next three” on Brief is the exception, and it is a deliberate one. Three games are three objects,
and once the section rules came out they read as one wide band of fragments with the dates stranded
mid-column. Those three are carded; the twelve are not. Cards are for a short set that spacing alone
leaves adrift, never for a long list.

The next game is marked by an accent border on the card and a text label. It never relies on colour
alone.

## Team portability

A new team is a typed configuration change, not a page redesign. `TeamConfig` owns:

- team identity, aliases, conference, and route;
- the `hue`, `chroma`, `structuralHue`, `structuralChroma`, and optional `structuralLightness`
  theme anchors — the structural three describe the **stage**, not the masthead;
- fan-facing copy and starter questions;
- the weekly lead, matchup read, and four keys;
- source rules and protected-mark guidance.

Components must not contain a team name, team color, matchup claim, or team-specific legal copy.
If adding a team requires changing a component, the boundary is wrong.

Two rules the second edition established, both of which cost a fix to honour:

- **No team-shaped assumptions in shared logic.** The question classifier reserved a single word for
  the team's name, which fit Texas and not Utah State. Anywhere a team's name, conference, or zone
  appears in shared code, it comes from `TeamConfig`.
- **Two editions must not read as one site with two names.** Every edition's accent hue is distinct
  from every other's.
- **The structural anchors describe the stage, not the masthead.** Whatever the school's primary
  is — navy, maroon, forest, burnt orange — it goes on the stage at the lightness it actually has.
  The masthead derives a restrained dark from the same hue. An earlier version of this rule sent
  the school's colour to the masthead and looked for a "counterweight" for bright primaries; that
  is what put a rival's navy on a Texas page. There is no counterweight. There is a team colour and
  a frame around it.

Schedules are not typed by hand. `pnpm schedule:build <slug> <IANA zone>` rebuilds a team's fixture
from CollegeFootballData, so kickoff times, venues, and broadcast assignments come back from the
source rather than from memory. A retyped schedule is wrong by October.

### Color roles

`deriveTeamPalettes()` builds light and dark palettes from the three anchors. Components consume only
semantic roles:

| Role | Use |
| --- | --- |
| `--team-page` | Paper ground. |
| `--team-surface`, `--team-surface-soft`, `--team-surface-strong` | Layered surfaces. |
| `--team-ink`, `--team-ink-subtle`, `--team-muted` | Text hierarchy. |
| `--team-border`, `--team-border-strong` | Card edges and control borders. Rarely a divider — see § Lines. |
| `--team-accent`, `--team-accent-strong`, `--team-accent-soft` | Team-derived emphasis and action. |
| `--team-on-accent` | Text on accent. |
| `--team-steel`, `--team-steel-raised`, `--team-on-steel` | **Chrome.** Masthead, issue bar, colophon. Always a restrained dark. |
| `--team-stage`, `--team-stage-raised`, `--team-on-stage` | **Stage.** The hero game object and the Matchup board — the surfaces that wear the team's real colour. |
| `--team-graphic-faint`, `--team-graphic`, `--team-graphic-strong` | Field Geometry's drawing ink: grid, secondary structure, and the route. |
| `--team-focus` | Keyboard focus. |

Light is the default. Dark is an explicit override, and that choice persists.

#### Display figures are set in the team colour

`--team-accent-strong` is a darkened accent that exists for one reason: accent text at body size
has to clear 4.5:1. It is a contrast compromise, not the team's colour, and at large sizes it reads
as a muddy brown-red instead of burnt orange.

So: **any large figure or display numeral uses `--team-accent`.** Countdowns, poll ranks, section
numbers, and key indices all take the real colour. Large text only needs 3:1 and the palette test
holds every edition to it. Reserve `--team-accent-strong` for accent text set at body size, where
the compromise is actually buying something.

#### Chrome and stage are different jobs

This is the rule the first three attempts at Texas each broke in a different way.

- **The stage is the team's colour.** One surface per view wears it: the hero game object on
  Brief, the board on Matchup. `structuralHue`, `structuralChroma`, and `structuralLightness`
  describe *this*, not the masthead. A school whose primary is bright says so with
  `structuralLightness`, and burnt orange is then actually burnt orange.
- **The chrome is never the team's colour.** The masthead, issue bar, and colophon are a
  restrained dark that carries the team's hue as a trace. They frame the issue; they are not it.
- **Chrome and stage must not be the same value.** A header painted the same colour as the
  surface directly beneath it reads as a rendering bug, not as structure. The palette test
  enforces a minimum separation.
- **The issue bar matches the masthead.** One dark header, not a strip of some other colour
  sitting on top of a strip of team colour.
- **The stage bleeds to the window edge.** The reading grid is capped at `--page-width`, but a
  coloured surface that stops at that cap leaves a paper margin down both sides and reads as a
  rendering fault. The panel spans `100vw` and pads its own content back onto the page grid, so the
  type stays in its column while the colour runs edge to edge.

#### Dark mode still belongs to the team

Going dark must not wash an edition to neutral grey. The stage keeps its hue and real chroma in
both themes, so a fan opening their team at night still sees their team.

The constraint that makes this hard is worth stating plainly, because it is a fact about colour
rather than a preference: **a warm hue cannot hold saturation at low lightness.** Orange, red, and
yellow become brown, maroon, and olive below roughly L35 — a dark burnt orange *is* chocolate.
Cool hues do not have this problem; navy at the same lightness still reads as navy.

So:

- Chrome takes only as much chroma as its hue can carry — capped hard for warm hues, looser for
  cool ones. A warm edition reads warm because the whole page is warm, not because the header is mud.
- The team's colour is delivered by the stage, the accent, and the field graphics, which all sit at
  lightnesses where the hue survives.
- Never fix a "too grey" dark mode by pushing chroma into a dark surface. Move the colour to a
  lighter element instead.

## Type and spacing

- **Big Shoulders:** wordmark, navigation, section heads, matchup, large figures, compact labels.
- **Geist:** body copy, controls, questions, and answers.
- **Geist with tabular figures:** dates, times, counts, state indices, and aligned labels. A third
  typeface is not needed for the data register.
- Display text may use uppercase and tracked letters. Body copy does not.
- Display line-height never drops below `1`.
- The named 4-point spacing scale in `tokens.css` is the only spacing scale.
- Text that must be read stays at or below `--measure`.

## Content rules

Write for a college football fan, not for the team building the product.

- Lead with the football point. Keep one idea per sentence.
- Prefer familiar words: “sources,” “still unknown,” “checked,” and “what to watch.”
- Keep section labels to one to four words.
- Keep starter questions short enough to scan in one line on desktop.
- Explain football terms only when they are not common fan vocabulary.
- Legal copy can be formal. Everything else should sound natural at a tailgate.

Never show product-building language in the interface. Banned examples include “AI,” “LLM,”
“provider,” “retrieval,” “model,” “confidence score,” “context thin,” “source desk,” “MVP,” “POC,”
“prototype,” “demo,” “renderer,” “fixture,” “pipeline,” “powered by,” and “intelligence platform.”

This extends to how the model is instructed, not just to copy someone types. The system
prompt once told the model to "say what the corpus is missing", and it dutifully told fans about
the corpus. Prompts are interface copy. Also banned in answers: "the corpus," "the excerpts,"
"source material," "retrieval," and "knowledge base" — note that plain "sources" stays approved,
because a fan understands a source and does not understand a corpus.

This extends to how the product describes its own rules and construction. A fan does not care that
something is enforced in code, shipped in a release, or configured somewhere — they care what they
get. Also banned: “code,” “codebase,” “database,” “deploy,” “goes live,” “built so,” “under the
hood,” and “by design.” Say what happens, not how it is made.

The one exception is authorship. “Written by fans” is a claim about who decides what matters, and it
is worth making because a general assistant cannot make it. It holds only while a person who watches
the games writes the reads a fan sees. If that stops being true, the line changes.

Avoid generic helper language, forced slang, rivalry hostility, betting certainty, injury rumors, and
claims of insider access.

## Questions and answers

The empty state is part of the page, not a floating chat card. After the first question, the thread
becomes a compact reading log:

- show the fan's question, the short answer, its sources, and when those sources were checked;
- strip citation markers from the prose and show source titles separately;
- use “Sources,” never “Evidence” or internal source labels;
- do not show a confidence badge;
- use “Checking sources” while an answer is on the way;
- errors say what failed and what the fan can do next;
- source titles link out when a public link exists.

Answers should usually fit in two short paragraphs. A long answer needs a real reason.

## Interaction and motion

Every control needs default, hover, active or selected, focus-visible, and disabled behavior.

- Tabs keep roving focus and arrow-key navigation.
- Matchup keys expose their selected state in text and shape, not color alone.
- **The team switcher is painted, not rebuilt.** It stays a native `<select>`; the styling replaces
  the UA arrow everywhere and, where `appearance: base-select` is supported, the open list too.
  Browsers without it keep their native picker. Do not replace this with a custom listbox to gain
  control of the open state — the native element is carrying keyboard behaviour, the mobile picker,
  and the accessibility tree, and a hand-built one would owe all three back. The open list belongs
  to the masthead: steel ground, chrome text, and the edition you are on marked in the header
  accent. Because a styled picker replaces the OS list, its rows carry their own 44px touch targets.
- “Ask about this” moves the selected question into the input and focuses it.
- Ready and planned source states use a mark plus a label.
- Touch targets are at least 44px where the layout allows.
- Hover never hides information from touch or keyboard users.
- **Only interactive things get hover states.** A hover response is a promise that something will
  happen if the fan clicks. Putting one on a row of text — a matters row, a ranking line, a
  schedule row that is an `li` and not a link — is visual flair that lies about what is clickable.
  Before adding one, check that the element actually contains a link or a control. Deviating from
  this needs a specific UX reason, stated where the rule is written.

Motion stays within four primitives: a short view settle, one navigation-or-selection state change,
a compact loading mark, and **the row marker** below. No entrance cascade, parallax, decorative
count-up, route drawing, or ambient loop. `prefers-reduced-motion` removes repeated and spatial
movement — the marker still appears, it just stops growing.

### Lines are drawn by interaction, not by default

Section One is a dense product, and the reflex when a page is dense is to rule it. That reflex is
what made the first production pass read as a ledger: 45 drawn border edges across 283 elements on
one Brief, a rule under every list row and around every section.

The correction, and the standard to hold new work to:

- **Separate with space first, surface second, a line last.** A change of ground — paper to stage,
  page to soft surface — is a stronger boundary than a hairline and adds no ink. Reach for a rule
  only when neither space nor surface can do the job.
- **A permanent line must earn itself.** The ones that survive: the masthead's lower edge, the issue
  bar's, and the accent bar marking the desk read. Everything else went to spacing.
- **Control borders are not dividers.** The team switcher, theme toggle, and question composer keep
  their borders — that is the affordance telling a fan the thing is operable. Do not count or cut
  those.
- **The row line became an interaction, on rows that are interactive.** News items carry a
  `--row-mark` accent bar that grows from the leading edge on `:hover` or `:focus-within`, because
  each one links out to its outlet. Rows that are only text get spacing and nothing else — see the
  hover rule above.
- **Where spacing alone leaves a section adrift, group it with a surface.** “Next three” is three
  cards: the ground does the work a border would have, the alignment inside reads as deliberate
  because there is an edge to align to, and three cards cost less ink than the rules they replaced.
  A card is a grouping device, not a control — it does not get a hover state.

When adding a section, count the rules you are about to draw and ask what each one separates that a
`--space-2xl` gap would not.

## Responsive and accessibility

The supported floor is 320 CSS pixels. `tests/e2e/responsive.spec.ts` sweeps 320 through 2560 and
asserts the contracts below that can be measured; verify the rest by eye at 320, 375, 414, 768,
1440, and a wide desktop.

- Start with one reading column. **Add a column only when the second one can hold its contents at
  full size**, not when the viewport merely has room. The Brief hero splits at 86rem; below that it
  is a stacked reading sequence. It used to split at 64rem, where the panel's own margin and padding
  consumed most of its track and the countdown clipped out of the box.
- The page never scrolls horizontally.
- Interactive labels remain on one line; their parent reflows first.
- Display headings wrap safely within long words.
- Tabs may scroll horizontally.
- Desktop field geometry in Matchup becomes a compact 2×2 key picker followed by the selected read
  on mobile.
- Stacked, the hero is editorial claim first and kickoff field second. The first viewport should
  reveal both rather than hiding the clock several screens down.
- A carded surface draws all four of its own edges at every width. This is asserted, because three
  separate rules each zeroed one side at some breakpoint and none of it was visible in review.
- The schedule keeps date, opponent, and kickoff visible at 320px; venue may wrap beneath opponent.
- Logical DOM order stays useful when columns collapse.
- Meet WCAG 2.2 AA. Keep focus visible in every theme.
- Test keyboard use, dark and light themes, reduced motion, and 200% zoom.

## How this system has failed before

Four bugs shipped or nearly shipped during the production redesign. None threw an error and none
were caught by review; each was found by looking at a rendered page. They are recorded because the
fix is cheap and the detection is not.

**A property the new rules relied on but never declared.** `team-workspace.module.css` used to be
two stylesheets stacked — the original rules, then a redesign block appended rather than replacing
them. Anything the redesign block did not declare fell through to a pre-redesign rule, *including
rules inside earlier media queries*. This produced the hero splitting from 40rem instead of 86rem,
and the game object being vertically centred instead of filling its half. The launch reconciliation
gave every selector one owner and moved responsive and state overrides after the base rules. When a
component changes shape, declare its layout properties explicitly even where the value looks like
the default; the responsive tests now hold that contract at its boundaries.

**A rule that was right for the old shape and wrong for the new one.** Converting a ruled section
into a card leaves behind declarations that used to make sense — `border-block-start: 0` on what was
a top-ruled section, `border-inline-end: 0` on what was a column divider, `padding-right: 0` on what
was a full-bleed row. Each one silently removed a card's edge or its padding. Changing a component's
shape means re-reading every declaration attached to it, not just adding the new ones.

**A colour that was correct in one theme and inverted in the other.** `--team-surface` sits above
the soft band in light mode and below it in dark, so a card raised in one theme sank in the other.
Any surface chosen for its relationship to another surface has to be checked in both themes.

**A value used for two jobs.** One structural role painted the masthead, the hero, and the Matchup
board, so no single value could be right for all three. Three separate attempts to fix the Texas
edition each traded one problem for another. When a token has to be a compromise, that is the signal
to split the role, not to keep retuning the value.

## Product and legal guardrails

- Section One is the product name, never a mascot-branded property.
- Do not use official logos, mascot imagery, mascot branding, protected hand-sign graphics, or
  official-affiliation language. Those are marks, and using them claims a relationship that does not
  exist.
- **Colour is not a mark.** Get as close to a school's real colours as the law allows. A fan opening
  their team's edition should see their team's colours, not a tasteful approximation, and hedging
  the hue protects nothing.
- The exception is contrast and usability. Where a school's own colour cannot carry the text on it
  or fails WCAG at the size it is used, move to the nearest workable value or a complement, and say
  in the config comment which one it is and why. Utah State's page ground is a pale tint of Aggie
  blue rather than the navy itself, because a navy page cannot carry body text.
- A team edition may feel local without copying institutional trade dress.
- The independence disclaimer remains visible in the colophon.

## Token exports

`tokens.css` is the source of truth. Runtime team values come from `deriveTeamPalettes()`.

### CSS custom properties

```css
:root {
  --font-display: var(--font-big-shoulders), "Arial Narrow", sans-serif;
  --font-body: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-outlier: var(--font-body);
  --radius-input: 0.375rem;
  --radius-card: 0.5rem;
  --page-width: 96rem;
  --measure: 62ch;
}
```

Feature CSS uses `--team-*` roles. Generated `--team-light-*` and `--team-dark-*` values are inputs to
the theme bridge, not component tokens.

### Tailwind CSS v4

`src/app/globals.css` maps the same roles through `@theme inline`:

```css
@theme inline {
  --color-team-page: var(--team-page, var(--color-paper));
  --color-team-ink: var(--team-ink, var(--color-ink));
  --color-team-rule: var(--team-border, var(--color-rule));
  --color-team-accent: var(--team-accent, var(--color-accent));
  --font-brand: var(--font-display);
  --font-sans: var(--font-body);
  --font-mono: var(--font-outlier);
}
```

### W3C Design Tokens Community Group

Export each generated team and mode with this shape. Generated values are authoritative.

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "team": {
      "page": { "$type": "color", "$value": "oklch(96.5% 0.0117 47)" },
      "ink": { "$type": "color", "$value": "oklch(20% 0.0129 47)" },
      "accent": { "$type": "color", "$value": "oklch(49% 0.13 47)" }
    }
  },
  "font": {
    "display": { "$type": "fontFamily", "$value": "Big Shoulders, Arial Narrow, sans-serif" },
    "body": { "$type": "fontFamily", "$value": "Geist, ui-sans-serif, sans-serif" },
    "outlier": { "$type": "fontFamily", "$value": "Geist, ui-sans-serif, sans-serif" }
  },
  "radius": {
    "card": { "$type": "dimension", "$value": "0.5rem" },
    "input": { "$type": "dimension", "$value": "0.375rem" }
  }
}
```

### shadcn/ui bridge

If shadcn/ui is introduced, map it onto Section One instead of importing its defaults:

```css
:root {
  --background: var(--team-page);
  --foreground: var(--team-ink);
  --card: var(--team-surface);
  --card-foreground: var(--team-ink);
  --primary: var(--team-accent);
  --primary-foreground: var(--team-on-accent);
  --secondary: var(--team-surface-soft);
  --secondary-foreground: var(--team-ink);
  --muted: var(--team-surface-soft);
  --muted-foreground: var(--team-muted);
  --border: var(--team-border);
  --input: var(--team-border-strong);
  --ring: var(--team-focus);
  --radius: var(--radius-card);
}
```
