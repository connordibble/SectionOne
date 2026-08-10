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

Push further:

- make countdowns, rankings, schedules, field position, routes, and matchup relationships the main
  graphic objects instead of reducing them to small labels;
- give the Section One mark a clear, recurring role without turning every section into branded
  wallpaper;
- use one memorable composition per view, with secondary information quieter around it;
- let desktop carry comparison and spatial context while mobile becomes a decisive reading sequence;
- use motion only to explain a state change: a route resolves, a ranking moves, a view changes, or a
  question opens its sources;
- keep photography exceptional and editorially useful; do not fill rectangles with interchangeable
  sports imagery;
- reserve team color for identity, selection, and emphasis so it gains force when it appears.

Avoid generic bento dashboards, glowing AI objects, ornamental stat cards, fake broadcast chrome,
ambient motion, and density copied unchanged from desktop to mobile.

## The production direction is one system with three clear roles

The redesign decision is settled. The directions are not blended in equal measure:

1. **The Desk owns the product shell.** It provides the split hero, editorial grid, source-adjacent
   utility, and the cleanest path from the working product to a professional sports briefing.
2. **Field Geometry owns the signature interaction.** It defines Matchup and supplies the field and
   route language used selectively in the kickoff object.
3. **Saturday Edition owns cadence.** It contributes the issue rail, folios, weekly reading sequence,
   and the sense that each briefing is a current publication.

The current implementation proves the structure with real Texas and Utah State editions, not one
desktop beauty shot. Keep testing comprehension, scan time, source trust, question discovery,
mobile reachability, and team portability as the content changes.

## Reconcile the two stylesheet layers before shipping

`team-workspace.module.css` is two stylesheets stacked: the original rules, then a redesign block
appended at the end rather than replacing them. Any property the redesign block does not explicitly
declare still falls through to a pre-redesign rule — including rules inside earlier media queries,
which then govern widths the redesign never intended to style.

This has already produced one shipped-quality bug. The Brief hero split into two columns from 40rem
up, because the redesign block never declared `grid-template-columns` and a legacy `min-width: 40rem`
rule did. Nothing errored; the kickoff panel simply clipped its own countdown at a range of widths.
It was found by eye, not by any test.

Before launch, reconcile the layers deliberately:

- fold the redesign block into the base rules so each selector is declared once;
- for every property the redesign relies on, confirm it is declared rather than inherited from a
  legacy rule — layout properties inside media queries are the dangerous ones;
- delete rules the redesign has fully superseded, rather than leaving them shadowed;
- extend `tests/e2e/responsive.spec.ts`, which encodes the hero's breakpoint contract, to whatever
  other layouts the audit shows are governed by fall-through.

Do not treat "it looks right at my window size" as evidence. The failure mode of this bug class is
that it is correct at most widths and broken at a few.

## Near-term sequence

1. Validate the production redesign with readers on Brief comprehension, Matchup selection, source
   trust, and question discovery.
2. Instrument the product before changing enough behavior to lose a clean baseline.
3. Resolve commercial data and source rights.
4. Operate a small edition set through multiple game weeks.
5. Add a direct return channel and measure the cohort it creates.
6. Expand editions or paid acquisition only after the publishing operation and return behavior are
   understood.
