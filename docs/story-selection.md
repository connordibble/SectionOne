# Story gathering and selection protocol

How the five items under **This week** get chosen. The rubric is in
`src/server/sources/story-selection.ts`; this document holds the judgement the
code cannot encode.

The reason any of this exists: a fan can already get a feed. What they cannot
get is five things that actually matter, chosen by someone who knows which
five. If the list is not defensible, the section is worse than nothing.

## 1. Gather

Collect candidates from a team's approved source list — never a general web
crawl. A crawl produces aggregation with no rights story and no way to tell a
beat reporter from an aggregator repeating one.

Every team's list should carry, in this order of preference:

| Tier | What it is | Examples |
| --- | --- | --- |
| `local` | Someone whose beat is this program. At practice, knows the two-deep. | Cache Valley Daily, Salt Lake Tribune, Burnt Orange Nation, Inside Texas |
| `national` | Real coverage that happens to be about everyone. | Sports Illustrated, ESPN, On3 |
| `official` | The athletic department. Accurate on facts, nobody's independent judgement. | utahstateaggies.com, texassports.com |

A team with fewer than three usable local sources is a team whose edition will
struggle, and that is worth knowing before launch rather than after.

## 2. Grade

Each candidate gets three scores, 0–5. Anchors matter more than precision —
two people grading the same week should land within a point.

### Impact — what it changes about Saturday

| | |
| --- | --- |
| 5 | Changes who plays or how they play. A starter settled, a scheme change, a unit rebuilt. |
| 4 | Changes what to watch for, but not the plan. |
| 3 | Real information, no change to expectations. Camp opening, a schedule release. |
| 2 | Context. Useful background a fan could have guessed. |
| 1 | Filler. Watch lists nobody acts on, hype pieces. |

### Echo — how many independent voices are on it

This is the closest thing to a measurement here. **Count, do not estimate.**
Independent means separate reporting, not three outlets rewriting one piece.

| | |
| --- | --- |
| 5 | Everyone has it, including outside the team's own market. |
| 3 | Two or three independent outlets, or one outlet plus visible fan discussion. |
| 1 | One outlet, no pickup. |

A 1 here is not a reason to drop a story. A high-impact single-source item
outranks a widely repeated small one by design — echo is a check on one desk's
pet angle becoming the week, not a popularity gate.

### Freshness — how much run it is getting *now*

Distinct from when it broke. A Monday story still being written about on Friday
is live; one that landed and died is not.

| | |
| --- | --- |
| 5 | Leading coverage today. |
| 3 | Still being referenced, no longer leading. |
| 1 | Reported once and dropped. |

Age is handled separately by decay (below) — do not double-count it here.

## 3. Score

```
base  = impact×0.45 + echo×0.30 + freshness×0.25 + (local ? 0.35 : 0)
score = base × 0.5^(ageInDays / 7)
```

- **Impact is weighted highest** so a real story carried by one outlet beats a
  small one everybody repeated.
- **The local bonus is deliberately small.** It breaks near-ties in favour of
  the people at practice. It must not let a thin local piece outrank a real
  national one, and there is a test asserting exactly that.
- **The half-life is one week**, the natural unit of a football news cycle.
  Last Saturday's story is worth half of this one at the same grade, so stale
  items fall off on their own instead of waiting to be pruned.

Grade against the **package's publication date**, not the clock. A package is a
snapshot of one week's judgement; re-ranking on every page view would silently
rewrite what was published.

## 4. Select

Take the top five by score, subject to a hard constraint:

- **No outlet holds more than two of five.** Three items from one masthead is
  one desk's read of the week presented as the week.
- **At least three distinct outlets.**
- **National must not outnumber local.**

The cap is applied *during* selection, not as a filter afterwards — filtering a
finished list just leaves holes. When the cap cannot be met, remaining slots are
filled anyway and `relaxed` is set. A short list is not more honest than an
unbalanced one; both are worse than knowing which you are looking at. A package
that comes back relaxed is a signal the source list is too narrow, not a
formatting problem.

`weekly.test.ts` asserts these against what actually shipped, per team. They are
requirements, not preferences.

## 5. Write

- Headline is ours and says what happened. Not the outlet's headline verbatim.
- The takeaway is one or two sentences on **why it matters for Saturday**, in
  the voice rules from `DESIGN.md`. It is our judgement, and it must be
  checkable against the thing it links to.
- Outlet and link are mandatory. We write the takeaway; we do not write the
  reporting, and a fan must always be one click from the difference.
- No injury speculation, no betting, no claims of inside information — this
  applies to the summary even when the source does it.

## Known gaps

- **Echo is graded by hand.** It is the one factor that could be measured
  directly, and it should be: counting distinct outlets on a theme is a
  gathering-time computation, not a judgement call. Until it is, it is the
  softest number in the rubric.
- **Dates for outlets that do not publish one** are inferred from context. Two
  items in the 2026-08-09 packages are dated this way.
- **Nothing enforces that a takeaway matches its link.** That is the check that
  matters most and the one still done by a person.
