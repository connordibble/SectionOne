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

## Edge Criteria

Nothing above can check these. `pnpm check` sees the repository; these live in the Cloudflare
dashboard, and the endpoint they protect is the one that spends money.

- [ ] **The three rate-limiting rules from [deploy.md](./deploy.md) § Rate limiting are configured.**
      Cloudflare → Security → WAF → Rate limiting rules. The origin limiter in
      `src/server/http/rate-limit.ts` is deliberately not the control: it is per-instance, so on
      serverless the real allowance is 20 × warm instances.

**Status: not configured as of 2026-08-28.** Twenty-one requests to `/api/chat` from a browser
returned twenty 200s and then a 429 with `retry-after: 44` — the configured origin limit, working.
But every response, the 429 included, carried an `x-vercel-id` header, so all twenty-one reached the
origin. An edge rule blocks before that. Presence of `x-vercel-id` on the 429 is the tell; that is
the check to repeat after configuring the rules, and the header should disappear.

Two notes for whoever does it:

- **Browser Integrity Check is already on, and it is not a rate limit.** The same twenty-one requests
  sent from a script were rejected at the edge with Cloudflare error 1010 on the browser signature,
  never reaching the origin. It stops a naive scraper for free, and it stops nothing that is
  browser-shaped: the run above got through by being a real browser, with no spoofing.
- **1010 also blocks legitimate non-browser callers.** An uptime monitor polling `/api/health` will
  be rejected by it. Allowlist the monitor, or confirm no such check is configured.

The probe costs nothing. `What are the betting odds for the opener?` hits the betting guardrail in
`prepareAnswer`, which returns before any provider call whatever provider is configured, so the run
is twenty-one requests and zero tokens.

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
