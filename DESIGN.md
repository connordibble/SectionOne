# Saturday Signal design system

This file is the product-facing design contract. Read it before changing a page, component, or
team theme. Extend it when the system grows; do not invent a second system inside a feature.

## Product idea

Saturday Signal turns a team's week into a short, sourced reading experience. It should answer
three questions faster than a general chatbot or a crowded fan site:

1. What matters before kickoff?
2. What should I watch once the game starts?
3. What evidence supports that read?

The feeling is a sharp Saturday sports desk: anticipatory, football-native, and enjoyable to scan.
The working rule is **all signal, no noise**. Every element must improve orientation, judgment, or
trust. If it only advertises the interface, remove it.

## Genre and shape

The genre is **editorial sports desk**, not SaaS dashboard and not newspaper cosplay. It borrows the
useful habits of a broadsheet—masthead, hierarchy, rules, a lead read, tabular data, named sources—
while behaving like a modern product.

The application has one persistent shell and four focused views:

| View | Job | Primary material |
| --- | --- | --- |
| **Brief** | Orient the fan in under a minute. | Real kickoff countdown, matchup, three active reads, editorial lead, ask entry, next three games. |
| **Matchup** | Turn watching into an informed activity. | Interactive four-cue Signal Board, selected-cue explanation, sourced starter read, ask handoff. |
| **Schedule** | Show sequence and context without a portal table. | Full chronological schedule, next-game emphasis, kickoff and broadcast information. |
| **Sources** | Make trust inspectable. | Readiness, descriptions, freshness, outbound records, known gaps, methodology. |

The chat thread is mounted once outside the view panels. Questions and answers persist while the
reader moves between tabs. Tabs are shareable through URL fragments; chat state is intentionally
session-local.

The countdown is always derived from schedule data. It may say a real number, `Today`, or `TBD`; it
must never be invented for visual effect.

## Masthead

The masthead is the product's strongest brand surface and must stay balanced.

- Left: Saturday Signal wordmark and issue line.
- Center: Brief, Matchup, Schedule, and Sources.
- Right: team switcher and theme control.
- Wide screens keep all three groups on one line without forcing the wordmark into a narrow column.
- Medium screens move navigation to its own line.
- Small screens use three calm rows: brand, full-width controls, then horizontally scrollable tabs.

The team name supports the Saturday Signal brand; it does not replace it. Never place an official
team logo in the masthead.

## Team portability

A new team is configuration work, not a redesign. Team-specific identity lives in the validated
`TeamConfig` schema in `src/config/team.ts`:

- identity, aliases, sport, conference, and canonical route;
- three theme anchors: `hue`, `chroma`, and `neutralHue`;
- source policy and protected-mark guidance;
- voice rules and suggested prompts;
- lead read, matchup thesis, and four Signal Board cues;
- provider identifiers and schedule season.

Components must not contain team names, team colors, matchup copy, or team-specific source policy.
If a second team requires editing a component, the platform boundary is wrong.

### Color system

`deriveTeamPalettes()` creates complete light and dark palettes from the three OKLCH anchors. The
lightness ladder and chroma relationships are shared across teams; hue supplies identity. This keeps
new deployments fast and makes contrast review repeatable.

Components consume semantic roles only:

| Token | Meaning |
| --- | --- |
| `--team-page` | Page ground. |
| `--team-surface`, `--team-surface-soft`, `--team-surface-strong` | Increasingly emphasized surfaces. |
| `--team-ink`, `--team-ink-subtle`, `--team-muted` | Text hierarchy. |
| `--team-border`, `--team-border-strong` | Hairlines and structural rules. |
| `--team-accent`, `--team-accent-strong`, `--team-accent-soft` | Team-derived action and status color. |
| `--team-on-accent` | Text or marks on the accent fill. |
| `--team-steel`, `--team-steel-raised`, `--team-on-steel` | Cool structural counterweight used by the masthead and game strip. |
| `--team-focus` | Visible keyboard focus. |

Accent should occupy roughly five percent or less of a viewport. It marks the wordmark, the active
view, the next game, and primary actions. Large team-color washes weaken both hierarchy and
portability.

Light, dark, and system modes share the same role names. The explicit choice persists locally.
System mode follows `prefers-color-scheme` without client-side palette calculations.

## Typography and data

- Display and body: Geist Sans. Use weight and scale before adding another face.
- Data: Geist Mono for dates, countdowns, status indices, and aligned figures only.
- Numerics use tabular figures.
- Sentence case is the default. Reserve uppercase for rare metadata, never section hierarchy.
- Headings describe reader value: “What matters,” “The read,” “Source ledger.” Avoid labels such as
  “AI insights,” “dashboard,” “demo,” or “powered by.”

The type scale and 4-point spacing scale live in `tokens.css`. Feature CSS consumes named tokens,
not raw pixel values.

## Composition

- **Rules over boxes.** A line separates ideas; a box indicates a real interaction or repeated unit.
- **No nested-card grids.** Signal cues and citations may repeat inside a larger composition because
  each is independently interactive or attributable.
- **One dominant idea per view.** Brief owns the countdown; Matchup owns the field; Schedule owns the
  chronology; Sources owns the ledger.
- **Readable measures.** Long prose stays at or below `--measure`. Chat answers do not span the full
  workspace.
- **Data stays aligned.** Dates, kickoff times, readiness counts, and schedule rows form columns at
  widths where columns help; on small screens they retain reading order rather than shrinking.

## Interaction states

Every control needs default, hover, active or selected, focus-visible, and disabled behavior.
Feedback must explain state rather than decorate it.

- Tabs expose `role="tab"`, selection state, roving focus, arrow-key navigation, Home, and End.
- Signal cues expose `aria-pressed`; state is conveyed by label and shape in addition to color.
- “Ask about this” moves the selected cue into the persistent composer and focuses the input.
- Source readiness uses text plus a mark; `Ready` and `Planned` are never color-only.
- The composer disables empty and in-flight submissions. Streaming state is announced without a
  blinking text caret.
- Focus rings use `--team-focus` and must remain visible in both modes.

Touch targets should be at least 44px when the layout allows. Hover effects are additive; no key
information may depend on hover.

## Motion

Motion should make the workspace feel alive on Saturday without making the content perform.

- View change: one short opacity-and-position settle using `--dur-short` and `--ease-out`.
- Tab change: the active rule and color transition at micro duration.
- Signal selection: cue surface, connector emphasis, and center read settle together.
- Controls: small press response and useful hover movement only.
- Streaming: a compact status pulse or spinner while the answer arrives.
- No entrance cascade, parallax, decorative counters, ambient loops, or animation library.

`prefers-reduced-motion: reduce` shortens transitions to 150ms or less, removes spatial travel, and
prevents repeated animation. The interface remains fully understandable with motion disabled.

## Responsive behavior

The supported floor is 320 CSS pixels.

- Start with a single reading column.
- At 40rem, regain horizontal rhythm and place masthead controls beside the brand.
- At 60rem, use the full balanced masthead and place the primary view beside the chat dock where the
  composition benefits.
- At 90rem, increase breathing room but do not increase prose measure.
- Signal cues become a clear list around the selected read on narrow screens; field geometry is an
  enhancement, not the only way to understand the relationships.
- Tabs may scroll horizontally. The page itself must never scroll horizontally.

## Accessibility

Meet WCAG 2.2 AA as a floor.

- Use semantic headings, lists, forms, tables or table-like alignment, and landmarks.
- Preserve logical DOM order when desktop columns rearrange visually.
- Pair every visual state with text and expose live answer updates politely.
- Keep text contrast at 4.5:1 and large text or meaningful UI graphics at 3:1.
- Do not remove outlines. Do not place low-contrast metadata on accent fills.
- Test keyboard-only navigation, system dark mode, explicit modes, reduced motion, 200% zoom, and
  the 320px layout before release.

## Content and trust

The voice is a smart fan analyst: direct, specific, skeptical of thin evidence, and fluent in early
downs, line play, explosiveness, field position, personnel, pressure, and finishing drives.

Avoid generic assistant language, forced slang, rivalry hostility, betting certainty, unsupported
injury speculation, and claims of insider access. `src/lib/content/voice.ts` enforces the configured
voice at the answer boundary.

Citations, freshness, confidence, and source gaps are interface elements. A polished answer without
traceable support is a failed answer. Fallback copy describes what the reader received, not internal
providers, fixtures, gates, or test infrastructure.

## Future visualization contract

Custom charts can deepen the moat, but they must enter through a controlled data contract rather
than arbitrary model-authored code.

1. The server returns a validated visualization specification with a title, question answered,
   chart type, axes, series, units, source IDs, freshness, and a prose summary.
2. The initial vocabulary stays small: line, bar, slope, and scatter. Add a type only when a real
   football question cannot be answered well by the existing set.
3. Every series cites retrieved records. Unsupported or incomparable values fail closed into a
   sourced prose answer.
4. The renderer owns layout, token-only color, tooltip behavior, empty/loading/error states, and
   responsive rules. The model never emits JSX, SVG, CSS, or executable chart options.
5. Every chart includes an accessible summary and a data-table alternative.
6. Team accent identifies the focal series; neutral roles carry comparisons. Never generate a new
   palette per answer.

Do not add a chart dependency until the first validated specification and representative data set
exist.

## Product and legal guardrails

- Saturday Signal is the system name, never a mascot-branded property.
- Do not use official logos, mascot imagery, Bevo branding, protected hand-sign graphics, official
  color values, or official-affiliation language.
- A team theme may feel locally relevant without copying institutional trade dress.
- Source rights and availability are data concerns, not visual details to hide.

## Token exports

The canonical primitives and semantic aliases live in `tokens.css`; runtime team values come from
`deriveTeamPalettes()`.

### CSS custom properties

Use `--team-*` roles in components. `--team-light-*` and `--team-dark-*` are generated inputs and
must not be consumed directly outside the theme bridge.

### Tailwind CSS v4

`src/app/globals.css` maps semantic roles inside `@theme inline`, producing utilities such as
`bg-team-page`, `text-team-ink`, `border-team-rule`, and `text-team-accent`. Add mappings there; do
not create a parallel `tailwind.config` palette.

### W3C Design Tokens Community Group format

A future exporter should serialize each derived team and mode after palette generation:

```json
{
  "color": {
    "team": {
      "page": { "$type": "color", "$value": "oklch(96.5% 0.0117 47)" },
      "ink": { "$type": "color", "$value": "oklch(20% 0.0129 47)" },
      "accent": { "$type": "color", "$value": "oklch(49% 0.13 47)" }
    }
  }
}
```

The snippet documents the shape only. Generated values—not copied examples—are authoritative.

### shadcn/ui semantic bridge

If shadcn/ui is introduced, map its roles to this system instead of importing its default palette:

| shadcn role | Saturday Signal role |
| --- | --- |
| `--background`, `--foreground` | `--team-page`, `--team-ink` |
| `--card`, `--card-foreground` | `--team-surface`, `--team-ink` |
| `--primary`, `--primary-foreground` | `--team-accent`, `--team-on-accent` |
| `--secondary`, `--secondary-foreground` | `--team-surface-soft`, `--team-ink` |
| `--muted`, `--muted-foreground` | `--team-surface-soft`, `--team-muted` |
| `--border`, `--input`, `--ring` | `--team-border`, `--team-border-strong`, `--team-focus` |

Component geometry and voice still follow this file; installing a component kit does not authorize
its default card density, radii, colors, or copy.
