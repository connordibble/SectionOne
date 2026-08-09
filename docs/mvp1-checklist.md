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
- 20 source documents (schedule, sample team notes, official links)
- CFBD warning when `CFBD_API_KEY` is absent

## Product Criteria

- Root route and `/teams/texas-football` load the Texas deployment.
- Chat answers cite sources and caveat rumor/injury/betting questions.
- The app shows next game, schedule scan, source readiness, and unofficial-project disclaimer.
- Voice evals reject generic AI copy and toxic rivalry bait.
- No UT logos, Bevo branding, or official-affiliation language are used as product branding.
