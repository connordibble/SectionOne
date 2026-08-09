# Working notes

Repo-level traps and open gaps that are not obvious from the code. Editorial
gaps live in [story-selection.md](./story-selection.md) § Known gaps; this file
is for how the project is worked on.

## Verification traps

### Playwright can silently test a stale server

`playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. Locally that
attaches to whatever is already listening on port 3000 instead of starting a
fresh one. If that process is a `pnpm dev` left over from manual API poking, the
whole suite runs against a different build than the one just made.

This has now produced two false alarms, the second a ~40-test failure that was
entirely the stale process. The tell is a wide, unrelated failure set —
navigation, overflow, and chat all breaking at once — rather than failures
clustered around what changed.

Before trusting a red run:

```bash
lsof -ti:3000 | xargs kill -9; pnpm build && pnpm test:e2e
```

The real fix is `reuseExistingServer: false`. The suite runs in about six
seconds, so a cold server start is cheap next to a class of failure that has
already cost two sessions. Not changed yet because it is a shared config and
nobody has asked for it.

### Fixture counts are asserted by number

`route.test.ts` and `workspace.spec.ts` both assert an exact
`documentCount`. Any new source document breaks them, which is intentional —
it forces a look at what was added — but the fix is to update the number, not
to loosen the assertion.

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
