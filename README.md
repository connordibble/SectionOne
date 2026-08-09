# Saturday Signal

Saturday Signal is an independent college-football intelligence desk: what matters before kickoff,
what to watch during the game, and the evidence behind the read.

The current Texas edition connects four views: Brief, Matchup, Schedule, and Sources. One grounded
chat thread follows the reader between them. Team identity, editorial cues, source
policy, and light/dark palettes live in typed configuration so another team does not require a UI
fork.

## Local development

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The root route loads the default team; the
canonical Texas route is `/teams/texas-football`.

## Quality gates

```bash
pnpm check
pnpm eval
pnpm build
pnpm ingest
pnpm test:e2e
pnpm release:check
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

- No official marks, mascot branding, institutional color values, or affiliation language.
- Team-specific choices belong in the validated team config, not component copy or CSS.
- Schedule and desk-note snapshots are usable today; official links and season statistics remain
  visible as planned sources until ingestion is connected.
- Retrieval is lexical today, with the storage schema ready for embeddings.
- Auth, billing, tenant administration, and source-rights management remain outside the first
  public edition.

## Roadmap

- Add a validated, citation-bearing visualization specification and an accessible renderer for a
  small chart vocabulary. Models will produce data specifications, never executable UI code.
- Add bring-your-own-key after deployment: encrypted user-scoped credentials, explicit provider
  selection, no platform-key fallback, redacted logs, revocation, and per-key usage attribution.
- Connect licensed notes, official records, and season-statistic ingestion team by team.
- Add tenant administration only when multiple editions need independent operators.

The design and portability contract lives in [DESIGN.md](./DESIGN.md).
