# Weekly publication uses one package

`data/editions/current.json` is the app's published registry. Each versioned package contains the
stories, summary, issue week, lead, matchup, four signals, next-game note and supporting desk notes.
Team configuration supplies permanent identity, voice, timezone and official schedule URL. Weekly
updates no longer require edits to team configuration, fixture imports or behavior-test answers.

The portable contract is `src/lib/editions/contract.ts`. It depends on Zod, with no Next.js or
provider imports. Other producers can consume its JSON Schema; the runtime validator also enforces
cross-field rules such as unique IDs, source dates and note references.

```sh
pnpm edition check
pnpm --silent edition schema > /tmp/edition.schema.json
pnpm edition export texas-football /tmp/draft.json
pnpm edition validate /tmp/draft.json
pnpm edition publish /tmp/draft.json
pnpm release:check
```

Export creates a draft envelope containing `baseRevision` and `edition`. Edit the edition, keeping
the revision unchanged. Publish archives the previous package under `data/editions/archive/`, then
atomically replaces the registry. It rejects stale drafts, backwards publication dates and future
packages. Reimporting identical content is a no-op. A filesystem lock serializes concurrent writers;
after an interrupted process, confirm no publisher is running before removing a leftover
`data/editions/.publish.lock`. Publication imports content only: it does not commit, push or deploy.

Use the private producer's `weekly-team-update` skill for editorial work. Its `publish` command
checks evidence and review state before invoking this consumer import. The public CLI validates the
reader contract; it cannot prove that reporting supports a claim. It is a trusted operator tool,
not an authenticated publishing service. Do not expose it as a public endpoint.

The private engine lives in the separate `SectionOneEngine` repository. Its local checkout can live
under `.private/edition-engine/`, which Git, TypeScript and ESLint exclude from this public app.
It has no source-code imports from the app; it invokes the documented CLI with an explicit app
path. Source captures, editorial reviews, prompts, costs and future model adapters stay private.

## Checks remain independent of the week's prose

Unit tests use the dated corpus in `src/test/fixtures/editions.json` and a fixed September 8, 2026
clock. Do not refresh that corpus as part of publishing: it preserves retrieval, routing and
citation regression cases. Publication tests read the real registry from disk, and browser tests
compare every rendered story and link against the accepted package on both viewport projects and
both themes. New teams need representative regression fixtures as part of onboarding.

`pnpm release:check` runs `pnpm check`, then Playwright. Playwright runs `pnpm build` and starts an
isolated production server with mock LLMs and no database credentials. CI uses that same build path;
there is no second build or reuse of an arbitrary development server. `pnpm check` already includes
the eval tests, so release does not rerun them separately.

## Scope of this release

The producer caches raw HTTP responses and inspected article text, creates bounded evidence packets,
requires review for each prose field and records measured usage by team/run. Revisions and source
hashes invalidate outdated approval. Quote matching and numeric checks catch some unsupported
claims; semantic support, original reporting, missing stories and latest status still need review.

This release makes no paid model calls and starts no recurring job. Automated source discovery,
publisher-specific extraction, model benchmarking, scheduled refreshes and unattended alert routing
remain follow-up work. It preserves the last good edition on failed validation; it does not add a
reader-facing stale indicator. API/model cost savings have not yet been measured.

## New-team data and colors

An initial edition needs typed identity, a complete package, a schedule capture, and a representative
behavior fixture. Add the schedule to the shared schedule adapter, then generate social cards with
`pnpm og:build`. The native team selector derives conference groups from enabled configuration.

`pnpm db:seed <team-slug>` registers the team, season, games, source documents, and embeddings in
the configured database. Omitting the slug still seeds Texas. Read back the records after seeding;
a successful page render does not establish that chat persistence has its foreign-key rows.

Ohio State and LSU retain their official primary on the stage in both modes. Their secondary colors
supply masthead highlights and field routes. The shared palette lifts a secondary route's lightness
when needed; contrast tests cover text, routes, and grid separation. Browser tests compare the new
teams' primary color tokens with the published school RGB values.

## Facts refresh independently of the briefing

AP rankings use ESPN's structured AP feed cross-checked against NCAA's AP table.
The adapter requires agreement on every ranked school, rank and point total, plus
compatible dates and a complete ranking. It does not use an LLM. A failed or
regressing refresh retains the last verified snapshot.

Pages and chat share a poll snapshot for each request. Refreshes are coalesced per
process for 15 minutes, with a two-minute retry interval after failure. The
`poll_snapshots` table preserves the latest accepted poll across cold starts;
`data/facts/ap-poll.json` is the bundled fallback. Run `pnpm db:migrate` to create
the table and `pnpm poll:refresh <season>` to refresh the bundled snapshot. A visit
after the cache interval triggers a check; this is not a push subscription or a
promise of an update at the exact release minute. No Codex automation is needed.

Rank lookup questions use those facts directly; explanations of ranking changes
still follow the research path. The page shows the poll's publication date and
last verification date and links to the published table. `SPORTS_FACTS=fixture`
disables live requests for tests and offline previews. Production should leave it
unset. Provider disagreement or a broken feed must never be fixed by relaxing
validation to admit partial results.

Schedules keep calendar dates even when kickoff times are TBD. Today's game stays
available through the team's local day unless a provider confirms it is final.
Past, final, postponed and cancelled games are not upcoming; the season opener is
never recycled as the next game. Countdown dates use the team's timezone.
Schedule provenance distinguishes the provider's retrieval from a separate
check of the official page. A CFBD refresh cannot claim an official-page check.

The poll file refresh and runtime refresh both reject older snapshots. File publication uses a lock and atomic replacement; failed validation preserves the existing file. Schedule acquisition requires successful, schema-valid game and media responses before replacement, rejects missing existing games and preserves the last snapshot after provider failure. API data is attributed to its provider, separately from the official schedule link fans can open.
