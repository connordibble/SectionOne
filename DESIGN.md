# Design — Saturday Signal

A locked design system for this app. Every page redesign reads this file before emitting code.
Do not regenerate per page — extend or amend this file when the system needs to grow.

Saturday Signal should feel like a **broadsheet sports desk**: masthead, lead story, fixture table,
visible sourcing. That reference matters more than it sounds. Fans have decades of muscle memory for
how football coverage is laid out, and the newspaper sports section — not a portal homepage — is
where that muscle memory comes from. Meeting it is Jakob's Law; fighting it costs the reader
attention we need for the actual product.

## Genre

**Editorial.** Specifically the sports-desk dialect: dense, scannable, sourced, unsentimental.
Not marketing-editorial (no generous whitespace-as-luxury), not dashboard-utilitarian (no
undifferentiated panel grid).

## Macrostructure families

- **App pages** (`/`, `/teams/[slug]`): **Stat-Led**. The lead figure is the countdown to kickoff —
  a real number derived from the schedule fixture. Everything below supports or qualifies it:
  chat workspace, fixture table, source colophon.
- **Content pages** (future: about, methodology): Long Document.
- **Marketing pages** (future: platform landing): Marquee Hero.

Pages within a family share the family's shape and vary only in component archetypes.

**The lead figure must always be real.** It is computed from fixture data, never invented, and it is
always paired with a worded headline — a bare number is not a headline.

## Theme — derived, not hand-tuned

Team palettes are **derived from OKLCH anchors**, not hand-picked hex values. A team supplies three
numbers; the system derives the full `--team-*` scale.

```ts
theme: { hue: 47, chroma: 0.13, neutralHue: 236 }
```

This is a platform decision, not a cosmetic one. Hand-tuning fourteen hex values per team is the
single biggest obstacle to "bring your own team" — it makes every new deployment a design project.
Deriving from a hue means a new team is a two-number decision, and because OKLCH is perceptually
uniform, contrast relationships hold automatically across hues instead of needing to be re-checked
by eye for every school.

Derived roles (names are stable; components consume these and nothing else):

| Token | Role |
| --- | --- |
| `--team-page` | Page ground. Warm, near-paper. |
| `--team-surface` / `--team-surface-soft` / `--team-surface-strong` | Raised surfaces, ascending weight. |
| `--team-ink` / `--team-ink-subtle` / `--team-muted` | Text, descending emphasis. |
| `--team-accent` / `--team-accent-strong` / `--team-accent-soft` | Team colour. Actions and marks only. |
| `--team-border` / `--team-border-strong` | Hairlines and structural rules. |
| `--team-steel` | Cool structural counterweight — masthead, next-game band. |
| `--team-contrast` | Text on accent/steel fills. |

**Accent discipline: ≤ 5 % of any viewport.** Orange marks actions, the live fixture, and the
wordmark. It never becomes a wash. The steel neutral is what keeps the page from reading as a
monochrome orange bath — pair every accent area against it.

## Typography

- Display · Geist, weight 600, roman. Never italic. Tabular figures on all numerics.
- Body · Geist, weight 400.
- Mono · Geist Mono — data only (kickoff times, dates, counts), never body copy.
- Type scale anchors live in `tokens.css` as `--text-*`. Components reference tokens, never raw sizes.

**Hierarchy is carried by size and weight, not by uppercase labels.** At most **two** uppercase
micro-labels per screen. The previous build had eight, which flattened the page — when everything is
a label, nothing is.

## Spacing

4-point named scale in `tokens.css` (`--space-*`). Never raw values.

## Motion

Motion-cut project — no animation library, and none should be added for decoration.

- Easings: `--ease-out` only. Never the browser default `ease`.
- Reveal pattern: **none**. Server-rendered content appears; it does not perform.
- Permitted motion: hover/active feedback on interactive elements, and the streaming caret.
- Reduced motion: opacity-only, ≤ 150 ms.

Stat-Led's default counter-tick on the lead figure is **deliberately not used** — it would require
client JS on a server component for pure decoration.

## Component voice

- **Rules over boxes.** Hairline rules separate content. A border is a structural claim, not default
  chrome.
- **No nested cards.** A card inside a card is banned unless the inner element is a genuinely
  repeated row (a fixture, a citation). This rule already existed and was being violated in two
  places; it is now enforced by review.
- **Buttons**: `--radius-input`, solid accent for the primary action, hairline outline for
  secondary. Text stays on one line at every breakpoint.
- **Data is tabular.** Schedules, ledgers, and figures use `font-variant-numeric: tabular-nums` and
  align on the numeral.

## Per-page allowances

- App pages **must not** use enrichment — function carries the page.
- Content pages: typography only.
- Marketing pages may use Tier-A CSS art or Tier-B hand-built SVG.

## What pages must share

The wordmark, the accent placement budget, the display + body fonts, the CTA voice, and the
source-transparency treatment (citations, freshness, confidence are interface, not footnotes).

## Product and legal guardrails

These are constraints, not style, and they outrank every aesthetic decision above.

- Saturday Signal is the system name — never a mascot or school-branded property.
- No official logos, mascot imagery, Bevo branding, protected hand-sign graphics, or trade dress.
- No official-affiliation language.
- Use a near-burnt-orange that reads Texas **without** using official University of Texas colour
  values.
- Team identity, source policy, and voice live in typed config. Hard-coded team colours in
  components are a bug unless they are neutral global primitives.
- Citations, freshness, and confidence are part of the interface, not footnotes hidden after the
  answer.

## Voice

Football-native: early downs, line of scrimmage, field position, explosiveness, pressure, personnel,
finishing drives. No generic AI phrasing, marketing copy, forced slang, rivalry toxicity, betting
certainty, or unsupported injury speculation. Enforced in code by `src/lib/content/voice.ts`.
