# MVP1 Acceptance Checklist

Section One MVP1 is considered healthy when these checks pass in the real repository:

```bash
pnpm check
pnpm eval
pnpm build
pnpm ingest
pnpm test:e2e
```

Database integration smoke:

```bash
docker compose up -d postgres
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saturday_signal pnpm db:migrate
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saturday_signal pnpm db:seed
```

Expected seed result:

- 12 games
- 26 source documents (schedule, team notes, official links, poll and weekly-news snapshots)
- CFBD warning when `CFBD_API_KEY` is absent

The document count is asserted by exact number in `src/app/api/ingest/route.test.ts` and
`tests/e2e/workspace.spec.ts`. Adding a source is meant to break them — update the number, do not
loosen the assertion.

## Product Criteria

- The root route loads the home page; `/teams/texas-football` and `/teams/utah-state-football` load
  their editions.
- Chat answers cite sources and caveat rumor/injury/betting questions.
- The app shows next game, schedule scan, source readiness, and unofficial-project disclaimer.
- Voice evals reject generic AI copy and toxic rivalry bait.
- No UT logos, Bevo branding, or official-affiliation language are used as product branding.
- Both editions read as their own team in light and dark, and the two do not read as one site with
  two names.
- No page scrolls horizontally and no carded surface is missing an edge, across the width sweep in
  `tests/e2e/responsive.spec.ts`.
