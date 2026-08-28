# Growth, distribution, and monetization

How Section One is supposed to reach readers and, eventually, pay for itself. This is a working
plan, not a set of claims about current performance. Nothing here is a shipped fact unless it is
marked as one.

Read `docs/future-work.md` first. It owns the product thesis and the evidence gates. This file owns
everything downstream of "the product is good": how anyone finds it, and what happens if enough
people do. Where the two disagree, future-work.md wins — in particular its rule that a small number
of reliably maintained editions beats a large number of thin ones.

## The constraint that decides everything

Section One is built and operated by one person who has a full-time senior engineering job. That is
not a temporary condition to be planned around; it is the design constraint that ranks above growth
and above revenue.

**Rule: reject any revenue or growth mechanism whose recurring work scales with the number of
readers and cannot be handled by automation or a deterministic system.**

This is not a preference. The entire thesis of the project is that one engineer can operate what
used to need an editorial staff. A revenue stream that reintroduces per-reader human work refutes
the thesis while appearing to validate it, because the money arrives before the workload does.

Applying the rule:

| Mechanism | Recurring work | Verdict |
| --- | --- | --- |
| Programmatic display ads | One integration, then ~none | **Qualifies** |
| Affiliate links (tickets, merch) | One integration, occasional link audit | **Qualifies** |
| Paid subscriptions | Support, billing, churn, refunds, auth, tax nexus | Rejected — scales with users |
| Direct/local sponsorship | Outbound sales, contracts, invoicing, renewals, per edition | Rejected — scales with editions *and* needs a salesperson |
| Sportsbook affiliate | High RPM, but state-by-state regulation and a trust cost | Rejected — see § Things deliberately not done |

The rule costs real money. Ads pay considerably less per reader than subscriptions do, and this
choice likely gives up the majority of theoretical revenue. That is the correct trade: the project's
value is the proof of operating leverage, and revenue that damages the proof is negative.

## The work, in order

The reasoning behind each item is in the sections below. Ordered by value per hour, and each phase
gates the next — do not start a phase because it is more interesting than the one before it.

### Phase 0 — Stop suppressing the site (days, not weeks)

- [x] **Add `generateMetadata` to `src/app/teams/[teamSlug]/page.tsx`.** Per-edition title,
      description, and a **self-referencing canonical**. This is the fix for the defect in
      § The canonical defect is fixed for launch; nothing else in this document mattered until it shipped.
- [x] Add a test asserting every enabled edition renders a canonical equal to its own URL. This
      failed silently in production and will again.
- [x] Generate per-edition 1200×630 OG images with `scripts/build-og-image.ts` and attach each one
      through the edition metadata. Matters for Discover and for every social share.
- [ ] `SportsEvent` JSON-LD for scheduled games, plus `WebSite` + `Organization` at the root.
      Generated from the same typed config the UI renders.
- [x] Verify the rendered `<head>` of every enabled edition in a browser, not in the source. The defect
      above was invisible in code review and obvious in the DOM.

### Phase 1 — Make the site findable (this off-season)

- [ ] Give Schedule and Matchup real routes; keep the tab UI via shallow routing. Roughly 3× the
      indexable surface from content that already exists.
- [x] Cookieless launch analytics for pageviews, paths, referrers, and daily unique visitors. Edition
      paths make the per-edition split automatic.
- [ ] Add session/cohort instrumentation that can distinguish new and returning readers across days.
      Vercel Web Analytics rotates its anonymous visitor identifier daily, so it cannot answer that
      retention question by itself.
- [ ] Email capture on every edition and on the home page. The owned channel compounds and starting
      late cannot be undone.
- [ ] About page, named operator, editorial policy, corrections process, AI-use disclosure. This is
      the E-E-A-T and scaled-content-abuse defense in § The risk that could sink the entire plan.
- [ ] Google Search Console and Bing Webmaster; submit the sitemap; watch for coverage exclusions —
      "Duplicate, Google chose different canonical" is the symptom of the Phase 0 defect.

### Phase 2 — The engine (the main body of work)

- [ ] Extract the engine to a private repo now, while it is still a file move. `LICENSE` is MIT and
      released code cannot be made private retroactively — see `docs/future-work.md` § Keep the
      public artifact and production business separable, and § The open-core boundary below.
- [ ] Deterministic facts layer from a structured API — evaluate CollegeFootballData.com first.
      **No fact ever originates from a model.**
- [ ] Per-team source registry in typed config; RSS acquisition; normalization with provenance.
- [ ] Content-hash change detection. This is what makes "what changed since Monday" mechanical, and
      the newsletter depends on it.
- [ ] Clustering and relevance ranking, with evals. Highest-leverage place to spend evaluation
      effort — ranking a fixed candidate set is checkable in a way that composition is not.
- [ ] Structured editorial plan as an intermediate artifact, before any prose.
- [ ] Verification gates: claim-to-source traceability, numbers cross-checked against the facts
      layer, voice, policy, link schemes.
- [ ] Publish gate with stale-edition fallback and alerting. Never publish unverified.
- [ ] The failure→fixture→gate mechanism, wired into `data/fixtures/` and `pnpm eval`.
- [ ] Instrument cost and human minutes per edition per week. This is the expansion go/no-go.

### Phase 3 — Distribution and scale (2026 season)

- [ ] Weekly newsletter off the change-detection layer. The habit, and the retention proof.
- [ ] Genuine participation in a small number of team communities. Does not scale to 24; concentrate.
- [ ] Discover optimization: freshness, entity clarity, large per-edition imagery.
- [ ] Expand editions only as the marginal-cost metric holds and source density clears the bar.

### Phase 4 — Revisit money (2027, not before)

- [ ] Check trailing-twelve-month sessions against the thresholds in § The entry thresholds.
- [ ] Decide and record the ad-density position before contacting any network.
- [ ] Legal review of commercial rights and trademark posture *before* revenue exists.

## Monetization

### Sequencing

Free product → measured traffic → ads. Not in any other order, and not in parallel. There is no
version of this where monetization work before traffic is a good use of the hours available.

Do not build ad infrastructure now. Do the two things that merely avoid foreclosing it:

1. **Analytics that can answer the entry questions.** Vercel Web Analytics now supplies cookieless
   pageviews, paths, referrers, and daily unique visitors. It does not retain an identifier across
   days, so monthly sessions and returning-vs-new cohorts still need a second, privacy-reviewed
   instrument before they are used as commercial evidence.
2. **Nothing else.** No slots, no placeholder components, no abstraction layer for a network not yet
   chosen.

### The entry thresholds are other people's, not ours

These are third-party admission requirements — external facts, subject to change, verify before
relying on any of them. They are recorded because they are the actual gates, not because they are
our targets. Per `docs/future-work.md`, do not adopt someone else's numbers as benchmarks.

| Network | Approximate minimum | Notes |
| --- | --- | --- |
| Google AdSense | None | Lowest RPM; the fallback, not the goal |
| Ezoic | Low / none | Middling RPM, heavier page-experience cost |
| Mediavine Journey | ~10k sessions/month | The realistic first real tier |
| Mediavine (full) | ~50k sessions/month | Meaningfully better RPM |
| Raptive | ~100k pageviews/month | Best rates, hardest gate |

Sports content in the US tends to earn a mid-range session RPM. Combined with the thresholds above,
the honest shape is: **the first tier that pays anything worth the integration is roughly 10k
sessions/month, and the first tier that pays real money is roughly 50k.**

### Two things that make the arithmetic worse than it looks

**Seasonality.** College football traffic is concentrated in roughly five months. Recruiting and
the portal produce smaller off-season spikes, but a peak-month revenue figure annualizes to well
under half of peak × 12. Any revenue estimate quoted in monthly terms during November is
approximately double the truth. Reason about this in trailing-twelve-month terms only.

**Ad density conflicts with the design contract.** `DESIGN.md` is a document about restraint, and
"All signal. No noise." is the brand line. Premium ad networks reach their quoted RPMs through ad
density — in-content units, sticky rails, video players — which is noise, precisely and literally.

This tension is real and unresolved, and it must be decided deliberately rather than discovered
during an integration. The position to start from:

- Ads never appear inside the Brief's reading sequence, the hero, or an answer from the Desk.
- Ad slots are band-level, between sections, and obey the same band rhythm as everything else.
- If a network's minimum density requires violating the above, decline the network and take the
  lower tier.

Record the outcome here when it is decided. A one-time revenue increase is not worth permanently
becoming the kind of site the product exists to be an alternative to.

### Realistic expectation

Season 2026 is very unlikely to reach the 10k threshold across the network, and that is fine. The
2026 objective is a repeatable Saturday habit and the evidence gates in future-work.md. Ads are a
2027 conversation. Anything earlier is a distraction with a plausible-sounding justification.

## Distribution and SEO

Traffic is the only input that matters, and it is the part with no engineering answer. The engine
does not produce readers.

### The canonical defect is fixed for launch

**Found 2026-08-10 against the running dev server.** `/teams/texas-football` rendered:

```
<title>Section One · College football</title>
<link rel="canonical" href="https://www.sectiononesports.com/">
<meta property="og:url" content="https://www.sectiononesports.com">
```

The route exported no `metadata` or `generateMetadata`. Next.js merges metadata shallowly across
segments and **inherits** any field a child does not set
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`, § Merging).
The root layout sets `alternates: { canonical: "/" }`, so every edition page inherits it.

The effect was that **every content page on the site told Google it was a duplicate of the
homepage.** A
self-referencing canonical is the single strongest signal that a URL is the one to index; pointing
it at another URL asks Google to drop the page. The site is currently competing for search traffic
with one indexable page. Every edition also shares one title, one description, and one OG image, so
even setting the canonical aside there is nothing to differentiate them in a result list.

The launch pass now generates a matchup-specific title and description, a self-referencing
canonical, matching `og:url`, and a 1200×630 social card for every enabled edition. Unit tests cover
the metadata builder and browser tests assert the rendered head for Texas and Utah State. Production
verification remains part of the deploy checklist because this defect is silent in code review.

### The URL surface is too thin to capture the traffic that exists

Only two routes exist: `/` and `/teams/[teamSlug]`. Brief, Matchup, and Schedule are client-side
views, so a team's schedule has no URL and cannot rank for anything.

The head terms — "texas football" — belong to ESPN, 247, and On3, permanently. Do not compete there.
The winnable queries are long-tail, high-intent, and regenerate weekly:

- "what time does utah state play saturday"
- "who is texas playing this week"
- "utah state vs [opponent] what to watch"
- "[team] schedule 2026"

Each of those wants its own indexable URL. A view that only exists as a tab cannot answer them.
Giving Schedule and Matchup real routes — with the tab UI preserved via shallow routing — multiplies
the indexable surface by roughly three at no editorial cost, since the content already exists.

### Structured data

Nothing on the site emits JSON-LD today (verified: zero `application/ld+json` nodes on an edition
page). For a product whose core facts are games, times, venues, and broadcasts, this is leaving the
most mechanical SEO win on the table.

- `SportsEvent` for each game — the direct answer to every kickoff-time query, and the input to
  Google's event surfaces.
- `BreadcrumbList` for the edition hierarchy.
- `WebSite` + `Organization` at the root, to establish the entity and disambiguate from Section I
  Athletics (the naming collision already noted in `src/app/layout.tsx`).
- Skip `FAQPage`. Google restricted those rich results to authoritative government and health sites;
  it is work with no remaining payoff.

Structured data should be generated from the same typed config and schedule data the UI renders, not
hand-maintained. If it can drift from the page, it will.

### The risk that could sink the entire plan

Google's spam policies name **scaled content abuse**: generating many pages primarily to
manipulate search rankings rather than to help people. Twenty-four AI-generated team sites is, read
uncharitably, a textbook description of the thing the policy targets. There is also a separate
policy on **site reputation abuse**. This is the single largest strategic risk to the growth plan,
larger than any competitor, and it is binary rather than gradual — a manual action removes the site.

The defenses are real, but they have to be built in rather than argued afterward:

- **Original value, not rewrites.** Section One's editorial claim, matchup keys, and "what matters"
  are analysis. Summarizing another outlet's story is not. The ratio matters, and the product's
  existing voice rules already push the right way.
- **Cite and link out generously.** Already the design contract — the source link is the basis for
  believing the summary. It is also the clearest signal that this is a briefing, not a content farm.
- **Genuine utility.** Schedules, kickoff times, and broadcast windows are facts a reader wants.
  Utility pages are not what the policy is aimed at.
- **Real E-E-A-T signals.** A named human author/operator, a substantive About page, a stated
  editorial policy, and a visible corrections process. A site with an accountable human behind it
  reads very differently to both a quality rater and an algorithm.
- **Never mass-generate pages per keyword.** One page per real thing. The moment the page count
  outruns the number of things Section One actually covers, the line has been crossed.
- **Disclose AI involvement honestly.** Google's stated position is that AI assistance is fine and
  low-value scaled output is not. Disclosure costs nothing and is consistent with the product's
  independence posture.

Do not scale to 24 editions before these are in place. Getting a manual action at 24 teams is a
far worse outcome than growing slower.

### Search is not the only channel, and probably not the first one

Search takes months to compound and Section One has no domain authority yet. The channels that can
produce readers this season:

- **Google Discover.** Disproportionately large for sports, driven by freshness, entity clarity, and
  large images — not by backlinks. This makes it far more accessible to a new site than search, and
  it is the strongest argument for per-edition OG imagery and correct structured data. Worth
  optimizing for deliberately.
- **Team subreddits and message boards.** This is where the fragmented-coverage fans already are,
  and it is the single best fit for the mid-major thesis. Self-promotion rules are strict and
  enforced; the only version that works is genuine participation, over months, with links as a
  minority of activity. This is real human time and does not scale to 24 teams — which is an
  argument for *concentrating* on a handful of communities, matching the future-work.md rule.
- **The newsletter.** Email is the only owned channel and the only one immune to an algorithm
  change. Capture email from day one, before there is any product to gate behind it, because the
  list compounds and the decision to start late cannot be undone retroactively.
- **Local beat reporters and podcasts.** Already named in future-work.md as a durable advantage.
  Linking out generously is the cheapest possible on-ramp to that relationship.

### Team selection should follow source density, not fanbase size

The mid-major thesis contains an inversion worth stating plainly: underserved fanbases have worse
alternatives, so the product is most valuable there — but they also have fewer sources, and the
engine's quality ceiling is set by what it can read. A program with two local outlets and a message
board is harder to brief well than one with ten.

So the first expansion filter is not fanbase size or requests. It is: **does enough source material
exist for the engine to clear its quality gates every week?** Some appealing fanbases will fail this
and should be declined rather than served badly.

## The engine

The goal is stated as "editor-level output, automated, many teams at once." The way to get there is
not a better prompt. It is to shrink the surface on which the model is permitted to exercise
judgment until what remains is reliably checkable.

### The open-core boundary

`docs/future-work.md` § Keep the public artifact and production business separable already records
the decision. This is the mechanical version of it.

**Draw the line on dependency, not on secrecy.** The test is "does the public repo import this?",
not "does this feel like secret sauce." The first is enforceable in CI; the second is a judgment call
that gets relitigated every week and eventually goes wrong.

The public app already passes that test. It reads a typed `WeeklyEdition` from `data/fixtures/` and
has never known how one was produced. Those fixtures stay: they are the demo data, the contract, and
the test corpus, and they keep working after the engine leaves.

- **Public:** UI, design system, team config schema, routing, provider interfaces, accessibility
  system, Playwright and eval examples, example fixtures, one or two demo editions.
- **Private:** acquisition, source registry and scoring, clustering, editorial planning, generation
  skills and prompts, verification gates, the production eval corpus, refresh and cost heuristics,
  operational tooling.

**Keep the contract dumb.** The engine writes `WeeklyEdition` plus provenance to a store; the app
reads it. Same shape as today with a network hop instead of a filesystem read. Do not build an API
between them until something other than the web app needs to call the engine — the newsletter will
be the thing that forces it, and it will teach the right shape.

Two cautions. First, **timing**: MIT-released code cannot be clawed back, so do not build the engine
in the public repo intending to extract it later. Second, **do not over-invest in generalizing the
engine for other verticals.** The orchestration shell is portable; the parts that make output good —
source hierarchy, what counts as a material change, what a fan needs on Thursday — are domain
specific and are most of the work. The second vertical, if it ever exists, will teach what was
actually shared. Guessing now just buys abstraction to maintain.

### The principle: facts are deterministic, narrative is generated

**No number, date, name, score, record, or kickoff time should ever originate from a language
model.** Those come from structured sources and are passed into generation as given facts. The model
composes, prioritizes, and explains; it never supplies a fact.

This single separation removes most of the hallucination surface, because the failures that destroy
trust are almost entirely factual: a wrong score, a player listed at the wrong position, an injury
that was not reported. Prose that is merely mediocre costs far less than a fact that is wrong.

It also makes verification tractable: every factual assertion in generated output can be checked
against the deterministic layer that produced it, automatically, before publication.

### Pipeline shape

The seam already exists at `src/server/ingest/`, and the app already consumes a typed
`WeeklyEdition` without knowing how it was produced. Build outward from there.

1. **Acquisition.** RSS remains the workhorse for local outlets; most still publish feeds. Official
   athletics sites for rosters, releases, and availability reports. A structured stats/schedule API
   for the deterministic facts layer — CollegeFootballData.com is the standard free option and
   should be evaluated first, subject to the commercial and redistribution terms already flagged in
   `docs/future-work.md` § Settle commercial rights before revenue. Per-team source lists belong in
   typed config, like everything else team-specific.
2. **Normalization.** One canonical document shape regardless of origin. Attach provenance at this
   step and never lose it — provenance is what makes every later gate possible.
3. **Change detection.** Content-hash every source; only reprocess what moved. This controls cost,
   but more importantly it is what makes *freshness* automatable: the question "what changed since
   Monday?" is the newsletter's entire value proposition and it should be answerable mechanically.
4. **Clustering and ranking.** Group reports of the same event; rank by relevance to a fan of this
   team this week. This is the most editorial judgment in the pipeline and the highest-leverage
   place to spend evaluation effort — ranking a fixed candidate set is far more checkable than open
   composition.
5. **Editorial planning.** Produce a structured plan — which stories, which angle, which keys —
   before any prose exists. A plan is inspectable and cheap to regenerate; an article is neither.
6. **Generation** against the plan and the deterministic facts, constrained by the existing voice
   rules in `docs/voice.md`.
7. **Verification gates.** Every claim traceable to a source. Every number cross-checked against the
   facts layer. Voice conformance. Policy conformance — no official marks, no affiliation language,
   per the standing legal guardrails. Link schemes validated (already shipped: `src/lib/safe-url.ts`).
8. **Publish gate.** If verification fails, **do not publish**. Retain the last good edition, mark it
   stale, and alert. A slightly old briefing is a minor problem; a confidently wrong one is the
   failure the whole product is trying to avoid.

### The output must degrade, never break

This is already the house standard in `docs/engineering-standards.md` and it applies with full force
here. A failed source, a failed model call, or a failed gate must produce a smaller, older, or
plainer edition — never a broken page and never a wrong one. Control flow does not change on a
reporting path.

### The eval corpus is the actual moat

Architecture is describable and therefore copyable. What is not copyable is the accumulated record
of everything that has gone wrong and the guardrails each failure produced.

That corpus only accumulates if there is a mechanism, so build the mechanism before it is needed:

> bad output → root cause → committed fixture → new deterministic rule, gate, or eval case

The fixtures directory (`data/fixtures/`) and `pnpm eval` are already the right home for this. Every
production error should end its life as a test that would have caught it. Over a season this becomes
the thing that makes the quality bar hard to reproduce.

### The test for whether the engine actually works

Not output quality in isolation. **Marginal cost of edition N+1.**

Going from 12 editions to 24 should add a small percentage to weekly operating time, not double it.
If it doubles, the architecture has not yet solved the business problem regardless of how good any
individual edition looks. Measure this explicitly — future-work.md already asks for "time and human
cost to publish one team for one week," and that metric is the go/no-go for expansion.

Two corollaries:

- **Adding a team should produce configuration and data, not code.** If a new edition needs a code
  change, the abstraction is wrong and expansion will not scale.
- **Incident response is the thing that scales badly, not generation.** Compute cost per edition is
  small and predictable. The cost that grows linearly with team count is human attention when
  something publishes wrong. That is why the gates must be preventative: "review everything before
  it publishes" is a strategy that fails silently somewhere around team eight.

## Things deliberately not done

Recorded so they are not rediscovered as fresh ideas.

- **Paid subscriptions**, for now. Rejected on the operator constraint, not on demand. If the free
  product ever demonstrates strong retention *and* the support surface can be automated, revisit —
  but the newsletter should prove the habit first.
- **Direct and local sponsorship.** Selling to N local businesses is a sales job that scales with
  edition count and cannot be automated. It is the exact inverse of the thesis.
- **Sportsbook affiliate revenue.** High RPM, but it carries state-by-state regulatory obligations,
  conflicts with the independence posture, and trades reader trust — the product's only real asset —
  for money. Not worth it at any realistic revenue level.
- **Multiple pricing tiers.** Tier design is overhead that only pays back at subscriber counts far
  beyond anything in view.
- **Expanding beyond college football.** The vertical specificity is a feature. The engine may
  generalize later; the product should not.

## Open questions

- What is the actual ad-density floor for a network worth integrating, and does any acceptable
  network exist within the design constraint? Decide before integrating, not during.
- Does per-edition Discover traffic behave differently for mid-majors than for large programs? This
  determines whether the mid-major thesis survives contact with distribution reality.
- What is the minimum source density for an edition to clear its quality gates weekly? This number,
  once known, is the expansion filter.
- Commercial-rights and trademark posture under monetization — see `docs/future-work.md` § Settle
  commercial rights before revenue and `LEGAL_NOTES.md`. Monetized changes the analysis; get it
  looked at before revenue exists, not after.
