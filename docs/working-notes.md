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

### The layered stylesheet trap is fixed, but its failure mode is worth keeping

`src/features/team-dashboard/team-workspace.module.css` used to contain the original rules followed
by an appended redesign block. Any property the redesign block did not explicitly declare fell
through to a pre-redesign rule — **including rules inside earlier media queries**, which then
governed widths the redesign never intended to style.

It has produced three visible layout bugs so far, none of which errored:

- the Brief hero split into two columns from 40rem instead of 86rem, because the redesign block
  never declared `grid-template-columns`, and the kickoff panel clipped its own countdown at the
  widths in between;
- the game object was vertically centred instead of filling its half, because the block never
  declared `align-items`;
- carded surfaces lost a single edge where an old `border-*: 0` was still in scope.

The launch pass folded the layers together. Each selector now has one owner per context, base rules
come before media and state queries, and reduced-motion rules come last so their overrides win. The
responsive suite guards the hero, schedule, shared section styling, card edges, and overflow at the
relevant breakpoints.

The tell remains useful: a layout that is correct at most widths and wrong at a few, with nothing in
the console. Declare layout properties explicitly when a component changes shape, even where the
value looks like the default.

### A client component was importing a server module for a date formatter

`team-workspace.tsx` is `"use client"` and imported `formatNewsDate` from
`server/sources/weekly.ts`. That pulled the whole module into the browser
bundle — fixture JSON and the story grader — and stayed invisible because
nothing in that chain touched a server-only API.

Adding `reportDegradation` to `weekly.ts` turned it into a hard build failure:
the reporter reaches `next/server`, which cannot be bundled for the client.
Turbopack prints the full import trace, which is the fastest way to read this
class of problem.

The formatter now lives in `src/lib/news-date.ts` and `weekly.ts` re-exports it
so server callers are unchanged. The rule worth keeping: a client component
importing anything under `src/server/` is a latent bundling bug even when it
builds — check what the module drags behind it, and prefer `import type` for
shapes, which is erased.

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
  is likely to drift during the season. The builder needs a local
  `CFBD_API_KEY`; the deployed app does not. The Utah State fixture was seeded
  by hand and has not yet been through that builder.
- **Two Utah State kickoffs were corrected from official sources on 2026-08-28.**
  September 12 at Washington is 1:30 p.m. MT on Big Ten Network. November 14 at
  San Diego State is 7:30 p.m. MT on USA Network. Fixture assertions now lock
  both values until the next generated schedule refresh.
- **Poll data is ranks only.** The published first-place vote counts for the
  2026 preseason Coaches Poll were internally inconsistent across sources, so
  only the ordering — which is corroborated — was taken.

## Unverified

- No live Postgres has been exercised. `llm_usage` and `team_requests` inserts
  are covered by dependency-injected tests only.
- CollegeFootballData's terms for commercial use have not been checked. That is
  a blocker before the product takes money, not before it launches.
- The model provider's account-level ceiling is external to this repository;
  nothing here can verify its amount or that it exists.
