# Product direction and future work

This file preserves decisions and useful hypotheses that should survive individual implementation
threads. It is not a launch checklist, and none of the targets below are claims about current usage.

## The product is a weekly briefing, not a general sports assistant

Section One answers three questions:

1. What matters this week?
2. What should I watch during the game?
3. What supports that read?

That boundary is the product. Chat supports the briefing; it is not the product category. A reader
who gets the answer in 60 seconds without asking a question may be better served than one who opens
the thread.

The strongest audience wedge is a passionate program with fragmented local coverage and limited
national attention. Large programs remain useful portability tests, but the sharper promise is a
dependable briefing for fans who otherwise have to assemble the week themselves.

## Live search closes a named gap; it does not replace the briefing

The committed weekly package cannot be the only way chat learns about a dismissal, injury update,
or depth-chart change. Manual additions scale with teams and news volume, which violates the
operator constraint. The chat fallback now uses OpenAI Responses web search only when the published
evidence gate cannot find the person or subject a reader named.

The shipped boundary is deliberately narrow:

- Each team's approved outlet domains live in typed config and are passed to the search tool. Chat
  does not expose unrestricted browsing.
- One search call is allowed per unanswered named-subject question and returned URLs are included as
  citations. The existing
  URL admission, citation, voice, budget, and rate-limit gates still apply.
- Prefer a recent official or local report. If the allowed sources do not establish the answer,
  keep the no-context response instead of widening the search automatically.
- Search token usage and acceptance are recorded in the existing LLM ledger. Latency, source-domain,
  unsupported-rate, and acceptance-failure dashboards remain follow-up instrumentation; search is
  justified only if it closes real coverage gaps without making chat slower or less trustworthy.

Normal escalation still uses Chat Completions. Only the named-gap fallback uses Responses, and the
server buffers it until URL admission and answer acceptance finish, so an unsafe draft never streams
to the browser. A source-rights review remains required before revenue.

## The next proof is a repeatable Saturday habit

Repository depth and first-visit polish do not establish product demand. The next operating test is
whether editions can be published on time for several game weeks and whether readers return without
being reminded.

Measure at least:

- next-game-week cohort return, including direct returns;
- edition freshness and missed-publication rate;
- time and human cost to publish one team for one week;
- source-link use and question use as separate behaviors;
- email or notification capture and the return it produces;
- unsupported-question, acceptance-gate, retry, cache, and deterministic-fallback rates;
- median answer latency and inference cost per session.

Do not adopt someone else's suggested thresholds as benchmarks. Establish the baseline with real
cohorts, then decide what improvement would justify expansion or paid acquisition.

## Grow the operating system before the team count

Two to four reliably maintained editions are a better first operating test than eight to twelve
thin ones. Add teams when source discovery, grading, publication, schedule refresh, and quality
review are repeatable at a known cost.

The durable advantage, if one develops, will be operational:

- a vetted source graph for programs that receive uneven coverage;
- historical weekly packages and editorial-quality labels;
- increasingly cheap team onboarding;
- measured ranking and retrieval feedback;
- direct distribution and accumulated reader habits;
- relationships with local reporters, podcasts, and fan communities.

The CSS, retrieval implementation, and scoring formula are useful engineering artifacts. They are
not the moat.

## Settle commercial rights before revenue

Confirm CollegeFootballData commercial and redistribution terms for the exact derived-data use
before charging money or supporting the product with meaningful advertising. A broader source and
IP review should cover summaries, ingestion, trademarks, and reporter material before commercial
scale. Independence and source links remain product requirements, not footer formalities.

`docs/growth-and-monetization.md` carries the distribution, SEO, engine, and revenue plan downstream
of this file, including the operator constraint that ranks above growth: reject any revenue or growth
mechanism whose recurring work scales with readers and cannot be automated. That rule is what rules
out subscriptions and direct sponsorship, and it is why advertising is the intended path.

## Keep the public artifact and production business separable

The released MIT code cannot be made private retroactively. A public reference implementation is
valuable for trust and as an engineering artifact, but the production system does not need to stay
in the same repository forever.

If the product becomes a business, preserve a deliberate public reference while allowing private
production work around source operations, reader data, distribution, experiments, ranking feedback,
billing, and operational infrastructure.

## The brand should make sports information the graphic material

The redesign target is not a prettier ESPN and not a sports page wearing SaaS chrome. It should feel
like a sports product built with the care of a strong software-design team.

Carry forward:

- the Brief, Matchup, and Schedule jobs;
- one question thread that follows the reader;
- restrained contextual team color;
- strong type, squared geometry, direct language, and source proximity;
- typed team portability and independence from institutional marks.

Delivered, and now governed by [DESIGN.md](../DESIGN.md) rather than by this brief — listed so the
brief is not re-read as an open backlog:

- countdowns, rankings, schedules, routes, and matchup relationships are the main graphic objects;
- the Section One mark has a recurring role and is drawn rather than placed, so it recolours;
- one memorable composition per view, with secondary information quieter around it;
- desktop carries comparison and spatial context; mobile is a decisive reading sequence;
- team colour is split into chrome and stage, so it has identity without flooding.

Still open:

- **Photography.** None has shipped. The standard stands: exceptional and editorially useful, never
  interchangeable rectangles. There is no photo pipeline, rights process, or art direction yet, and
  adding one is a real project rather than a visual tweak.
- **Motion beyond a state change.** What ships today is a view settle, selection changes, a loading
  mark, and the row marker. A richer reveal — the kind that makes a section feel authored rather
  than laid out — has been discussed and deliberately not built. Pick one or two places it earns
  its keep rather than scattering scroll animation.
- **Whether any of this helps.** The redesign has not been in front of readers. See the evidence
  gates above; a better-looking page is not evidence.

Avoid generic bento dashboards, glowing AI objects, ornamental stat cards, fake broadcast chrome,
ambient motion, and density copied unchanged from desktop to mobile.

## The production direction is one system with three clear roles

The redesign decision is settled. The directions are not blended in equal measure:

1. **The Desk owns the product shell.** It provides the split hero, editorial grid, source-adjacent
   utility, and the cleanest path from the working product to a professional sports briefing.
2. **Field Geometry owns the signature interaction.** It defines Matchup and supplies the field and
   route language used selectively in the kickoff object.
3. **Saturday Edition owns cadence.** It contributes the issue bar, folios, weekly reading sequence,
   and the sense that each briefing is a current publication.

The current implementation proves the structure with real Texas and Utah State editions, not one
desktop beauty shot. Keep testing comprehension, scan time, source trust, question discovery,
mobile reachability, and team portability as the content changes.

One correction the build produced, recorded because it was expensive to find: **Field Geometry is
for Matchup and the kickoff object only.** Extending it to schedules and rankings was proposed and
rejected — those are tables, and ruling them is what makes a signature tiring. The language earns
its force by being rare.

## The stylesheet layers were reconciled for launch

The production redesign was originally appended below the old stylesheet. That allowed undeclared
properties and legacy media queries to keep controlling the new composition. The launch pass folded
those layers together so every selector has one owner in each context, base rules precede the
responsive and state queries, and the legacy 60rem desktop rule now shares the 64rem boundary used
by the design contract. The Brief stays stacked until its deliberate 86rem split.

The audit left no duplicate selector/context groups or duplicate declarations. The responsive suite
now checks the Brief split, the Schedule row and strip alignment, the shared section colours, card
edges, and horizontal overflow at the boundary widths. A 56-screen comparison covered both
editions, both themes, and 320–1440px: 52 captures were pixel-identical to the pre-reconciliation
render; the four 960px captures changed only at the normalized desktop boundary.

Keep the lesson even though the gate is closed: "it looks right at my window size" is not evidence.
This bug class is correct at most widths, broken at a few, and silent in the console.

## Near-term sequence

1. Validate the production redesign with readers on Brief comprehension, Matchup selection, source
   trust, and question discovery.
2. Instrument the product before changing enough behavior to lose a clean baseline.
3. Resolve commercial data and source rights.
4. Operate a small edition set through multiple game weeks.
5. Add a direct return channel and measure the cohort it creates.
6. Expand editions or paid acquisition only after the publishing operation and return behavior are
   understood.
