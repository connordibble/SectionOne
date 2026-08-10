# Working notes

Repo-level traps and open gaps that are not obvious from the code. Editorial
gaps live in [story-selection.md](./story-selection.md) § Known gaps; this file
is for how the project is worked on.

## Verification traps

### Playwright used to silently test a stale server — fixed

`playwright.config.ts` once ran on port 3000 with `reuseExistingServer` set
outside CI, so the suite would attach to whatever dev server was already there.
Twice that produced a wide red run — navigation, overflow and chat all failing
at once — that was really old code being served.

It now builds and serves its own production build on port **3100**
(`E2E_PORT` overrides). A dev server can stay up on 3000 while the suite runs,
and the suite cannot test anything but what it just built. The tell for the old
failure mode, worth remembering: failures scattered across unrelated areas
rather than clustered around what changed.

### One stylesheet is layered over another, and the lower one still wins

`src/features/team-dashboard/team-workspace.module.css` is two stylesheets in one file: the
original rules, then a redesign block appended at the end rather than replacing them. Any property
the redesign block does not explicitly declare falls through to a pre-redesign rule — **including
rules inside earlier media queries**, which then govern widths the redesign never intended to style.

It has produced three visible layout bugs so far, none of which errored:

- the Brief hero split into two columns from 40rem instead of 86rem, because the redesign block
  never declared `grid-template-columns`, and the kickoff panel clipped its own countdown at the
  widths in between;
- the game object was vertically centred instead of filling its half, because the block never
  declared `align-items`;
- carded surfaces lost a single edge where an old `border-*: 0` was still in scope.

The tell: a layout that is correct at most widths and wrong at a few, with nothing in the console.
Declare layout properties explicitly when a block takes over a component, even where the value looks
like the default. `tests/e2e/responsive.spec.ts` now asserts the hero's breakpoint contract and card
edges across the width range. Folding the layers together is tracked in
[future-work.md](./future-work.md).

### Fixture counts are asserted by number

`route.test.ts` and `workspace.spec.ts` both assert an exact
`documentCount`. Any new source document breaks them, which is intentional —
it forces a look at what was added — but the fix is to update the number, not
to loosen the assertion.

### Standalone scripts need their own env loading

Next.js reads `.env.local` for the app; `tsx` does not. Every script under
`scripts/` therefore saw an empty environment and failed with a confusing
"DATABASE_URL is required" on a machine where the variable was plainly set.

They now run with `--env-file-if-exists=.env.local`, which loads it when
present and continues without it in CI. That flag needs Node 22.9, so the
`engines.node` floor moved up to match.

## Data provenance

- **Schedules are build outputs.** `pnpm schedule:build <slug> <IANA zone>`
  regenerates a team's fixture from CollegeFootballData. Anything typed by hand
  is wrong by October. The Utah State fixture was seeded by hand from published
  sources and has not yet been through the script, because it needs a
  `CFBD_API_KEY`.
- **One Utah State kickoff is a judgement call.** Two sources disagreed on the
  September 12 time at Washington. The corroborated value is in the fixture; it
  is the row to re-check first.
- **Poll data is ranks only.** The published first-place vote counts for the
  2026 preseason Coaches Poll were internally inconsistent across sources, so
  only the ordering — which is corroborated — was taken.

## Unverified

- No live Postgres has been exercised. `llm_usage` and `team_requests` inserts
  are covered by dependency-injected tests only.
- CollegeFootballData's terms for commercial use have not been checked. That is
  a blocker before the product takes money, not before it launches.
- The `$15` provider ceiling is set on the Anthropic workspace, not in this
  repo, and nothing here can verify it exists.
