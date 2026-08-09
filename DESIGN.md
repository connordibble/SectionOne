# Section One design system

This is the shared design contract for every team edition. Extend this system when the product
grows. Do not create a second visual language inside one feature.

## North star

Section One should feel like the best page in a Saturday game program: quick to scan, specific
about football, and worth opening before kickoff.

The rule is **all signal, no noise**. Every element must help a fan answer one of three questions:

1. What matters this week?
2. What should I watch during the game?
3. What supports that read?

## Visual signature

The genre is an **editorial game program**, not a dashboard and not a newspaper costume.

- Warm paper ground, dark navy structure, and a restrained team accent.
- Condensed display type for the masthead, section heads, matchup, and large figures.
- Plain body type for every sentence a fan must read.
- Mono type only for dates, times, scores, counts, and aligned labels.
- Strong horizontal rules and squared geometry. Boxes are for real controls or repeated choices.
- Dense, aligned rows at wide widths; calm single-column reading on small screens.
- Accent stays near five percent of the canvas. It points; it does not flood.

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

At wide widths, Brief should read as one composed page rather than a stack of cards.

1. A dark masthead holds the issue line, brand, navigation, team switcher, and theme control.
2. The hero pairs a large countdown with matchup, kickoff, venue, and one short orange takeaway.
3. “What matters Saturday” uses three numbered rows. Title and plain-English cue share a line.
4. “The read” is two or three short sentences, followed by a source line.
5. “Tune your signal” is one full-width input with no chat-window framing in the empty state.
6. A “Quick questions” rail labels two short starter questions below the input.
7. “In the field” gives the team's own poll standing and the ranked weeks on its own schedule.
8. “This week” is up to five items: headline, one takeaway sentence, and the outlet behind it.
9. “Next three” is one horizontal schedule strip on wide screens and three clear rows on mobile.
10. The colophon stays small and factual.

Two rules govern the weekly sections:

- **Rankings are read from the team outward.** Most teams are unranked, and a national top 25 answers
  nothing for them. The standing line is one line; the list underneath is the ranked opponents on
  that team's own schedule, hardest first. A poll that has not been released says so.
- **We write the takeaway; we do not write the reporting.** Every news item carries its outlet and a
  link out. The summary is ours and must be checkable against the thing it links to. An item without
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

The home page shares the tokens, masthead language, rule discipline, and voice — and deliberately
not the shape. An edition is a Stat-Led dashboard built around a live countdown; the home page is a
ruled argument that ends in one action. If the two ever read as the same page, the product and its
pitch have blurred.

Home page rules:

- The masthead wordmark is site identity, not the page heading. The `h1` is the fan promise.
- Every claim about scale is counted from `enabledTeamSlugs`, never written by hand. One edition is
  one edition.
- The edition card renders real config and schedule data. A picture of the product would drift; the
  product itself cannot.
- Anchor targets clear the sticky masthead.
- House colour comes from `houseTheme`, not from a team. Editions may ship in any hue; the home page
  does not follow them.
- One exception, bounded to the edition card: the card may carry its own edition's accent on a
  hairline rule and the countdown figure. Everything outside the card border stays house. A fan
  should be able to see that editions are coloured for their team without the page changing colour
  when a new one ships.

## Masthead

The masthead is the strongest brand surface.

- Wide: issue line, brand, three-view navigation, and controls share one line.
- Medium: brand and controls lead; navigation moves to its own line.
- Small: brand, controls, and a horizontally scrollable tab row.
- The brand line is always “All signal. No noise.”
- The team supports the Section One name. It never replaces it.
- No official team logo belongs in the masthead.

## Team portability

A new team is a typed configuration change, not a page redesign. `TeamConfig` owns:

- team identity, aliases, conference, and route;
- `hue`, `chroma`, `structuralHue`, and `structuralChroma` theme anchors;
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
- **The structural dark belongs to the school when the school has one.** A team whose primary is
  already dark — navy, maroon, forest — puts that colour in the masthead. Only a team whose primary
  is too bright to be structure, as burnt orange is, gets a counterweight instead. Getting this
  backwards is what gave Utah State a brown masthead in its first draft.

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
| `--team-border`, `--team-border-strong` | Rules and dividers. |
| `--team-accent`, `--team-accent-strong`, `--team-accent-soft` | Team-derived emphasis and action. |
| `--team-on-accent` | Text on accent. |
| `--team-steel`, `--team-steel-raised`, `--team-on-steel` | Masthead and dark structural areas. Derived from `structuralHue`/`structuralChroma`, which is the school's own dark where it has one. |
| `--team-focus` | Keyboard focus. |

Light is the default. Dark is an explicit override, and that choice persists.

## Type and spacing

- **Big Shoulders:** wordmark, navigation, section heads, matchup, large figures, compact labels.
- **Geist:** body copy, controls, questions, and answers.
- **Geist Mono:** dates, times, counts, state indices, and tabular figures.
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
- “Ask about this” moves the selected question into the input and focuses it.
- Ready and planned source states use a mark plus a label.
- Touch targets are at least 44px where the layout allows.
- Hover never hides information from touch or keyboard users.

Motion stays quiet: a short view settle, an active tab rule, a selected-key change, and a compact
loading mark. No entrance cascade, parallax, decorative count-up, or ambient loop.
`prefers-reduced-motion` removes repeated and spatial movement.

## Responsive and accessibility

The supported floor is 320 CSS pixels. Verify 320, 375, 414, 768, 1440, and a wide desktop.

- Start with one reading column. Add columns only when the content has room.
- The page never scrolls horizontally.
- Interactive labels remain on one line; their parent reflows first.
- Display headings wrap safely within long words.
- Tabs may scroll horizontally.
- Desktop field geometry in Matchup becomes a compact 2×2 key picker followed by the selected read
  on mobile.
- Logical DOM order stays useful when columns collapse.
- Meet WCAG 2.2 AA. Keep focus visible in every theme.
- Test keyboard use, dark and light themes, reduced motion, and 200% zoom.

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
  --font-outlier: var(--font-geist-mono), ui-monospace, monospace;
  --radius-card: 2px;
  --radius-input: 2px;
  --page-width: 88rem;
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
    "outlier": { "$type": "fontFamily", "$value": "Geist Mono, ui-monospace, monospace" }
  },
  "radius": {
    "card": { "$type": "dimension", "$value": "2px" },
    "input": { "$type": "dimension", "$value": "2px" }
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
