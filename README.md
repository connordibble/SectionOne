# Section One

Section One is an independent college-football intelligence desk: what matters before kickoff,
what to watch during the game, and the evidence behind the read.

Two editions are live — Texas and Utah State — deliberately one blue blood and one program outside
the national conversation, because the second is the case the product is actually for.

Each edition connects three views: Brief, Matchup, and Schedule. One grounded chat thread follows
the reader between them. Brief also carries the team's poll standing read against its own schedule,
and a graded weekly briefing of up to five stories. Team identity, editorial cues, source policy,
and light/dark palettes live in typed configuration, so another team is a data change rather than a
UI fork.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The root route is the home page; editions live
at `/teams/[slug]` — `/teams/texas-football` and `/teams/utah-state-football`.

## Quality gates

```bash
pnpm check
pnpm eval
pnpm build
pnpm ingest
pnpm test:e2e
pnpm release:check
```

Schedules are build outputs, not hand-maintained files. With `CFBD_API_KEY` set:

```bash
pnpm schedule:build utah-state-football America/Denver
```

## Local data services

```bash
docker compose up -d
pnpm db:migrate
pnpm ingest
pnpm db:seed
```

`pnpm ingest` works offline from committed source snapshots. `pnpm db:seed` requires `DATABASE_URL`
and persists the team, 2026 schedule, and source documents.

## API surface

- `GET /api/health` reports service status, database configuration, active answer provider,
  per-team source readiness, and enabled team slugs.
- `POST /api/ingest` returns the normalized source corpus for a team.
- `POST /api/chat` accepts `{ message, teamSlug?, history?, sessionId? }` and returns a grounded
  answer with citations, confidence, freshness, and provider metadata. With
  `Accept: text/event-stream`, it emits `citations`, incremental `delta`, and `done` events. With
  `DATABASE_URL` configured, exchanges persist to `chat_sessions` and `chat_messages`.

## Answer providers

Generation sits behind one `LlmProvider` interface in `src/server/llm`.

- `mock` is the deterministic local composer. It needs no key and provides the verified local read
  if a live provider is unavailable or fails the sourcing gate.
- `anthropic` uses `ANTHROPIC_API_KEY`; `ANTHROPIC_MODEL` overrides the configured default.
- `openai` uses `OPENAI_API_KEY`; `OPENAI_MODEL` overrides the configured default.

Provider selection follows the available key, with Anthropic first when both exist. Set
`LLM_PROVIDER=mock|anthropic|openai` to choose explicitly. The health endpoint reports the active
provider. Add another provider by implementing `LlmProvider` and registering it in
`src/server/llm/registry.ts`.

## Product boundaries

- No official logos, mascot branding, protected graphics, or affiliation language. Colour is not a
  mark: editions get as close to a school's real colours as contrast allows, and deviate only where
  a colour cannot carry the text on it.
- Team-specific choices belong in the validated team config, not component copy or CSS.
- Schedule, desk-note, poll, and weekly-news snapshots are usable today; season statistics remain
  visible as a planned source until ingestion is connected.
- Weekly stories are graded on impact, echo, and freshness, decayed by age, and capped at two per
  outlet so no single masthead owns a briefing. See [docs/story-selection.md](./docs/story-selection.md).
- Retrieval is lexical by default and hybrid lexical + pgvector when `DATABASE_URL` is configured,
  fused by reciprocal rank.
- Auth, billing, tenant administration, and source-rights management remain outside the first
  public edition.

## Roadmap

- Add a validated, citation-bearing visualization specification and an accessible renderer for a
  small chart vocabulary. Models will produce data specifications, never executable UI code.
- Add bring-your-own-key after deployment: encrypted user-scoped credentials, explicit provider
  selection, no platform-key fallback, redacted logs, revocation, and per-key usage attribution.
- Connect licensed notes, official records, and season-statistic ingestion team by team.
- Add tenant administration only when multiple editions need independent operators.

Deployment, CI, and the edge rate-limiting rules live in
[docs/deploy.md](./docs/deploy.md).

The design and portability contract lives in [DESIGN.md](./DESIGN.md). The story rubric lives in
[docs/story-selection.md](./docs/story-selection.md), and repo traps and open gaps in
[docs/working-notes.md](./docs/working-notes.md).
