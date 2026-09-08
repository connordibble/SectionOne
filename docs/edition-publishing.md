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
