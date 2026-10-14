# 2026 team expansion

The authorized expansion adds twelve programs to the existing eight, in three
batches of four. Each batch uses the private producer's reviewed onboarding
package and the public app's shared team and edition contracts.

| Batch | Programs | State |
| --- | --- | --- |
| 1 | Notre Dame, Michigan, Penn State, Miami | Activated and verified |
| 2 | Tennessee, BYU, Texas Tech, Indiana | Activated and verified |
| 3 | Boise State, James Madison, App State, Fresno State | Activated and verified |

Batch 1 has twelve-game schedules, verified completed scores, sourced AP ranks
at kickoff, five selected stories per program, four matchup signals, social
cards, and matching private source configuration. Database seeding registered
48 games; `pnpm teams check --database` read the records back successfully.
Maintenance discovers all four programs and reports no pending result checks.

The first release pass passed 489 unit tests, 246 browser tests, the production
build, 26 engine tests, and the engine's isolated app integration check. Visual
inspection covered all four views at 375px and 1280px in light and dark themes,
with 64 saved captures. The expansion browser suite also checks intact school
names at 320, 375, 1280, 1376, 1440, and 1920px.

Two corrections came from review: Miami's secondary token needed additional
lightness so its field route cleared the grid contrast requirement; Penn State's
Coaches Show belongs to Penn State's reporting origin, so the viewing item uses
Michigan's original official game page. The latter received a fresh full review
and revision-checked publication. No source-policy limit was relaxed.

The existing eight schedules produce age warnings in the readiness check. Those
warnings predate this expansion. The new schedules were inspected against live
official pages; missing future broadcast assignments remain TBD.

Batch 2 registers another 48 games and passes database readback. All 22 newly
completed opponents have verified kickoff-day AP status, with none missing.
Each program has five distinct stories across at least three original reporting
origins and four reviewed game watch points. Maintenance discovers all sixteen
programs and requests no result checks for the additions.

Batch 2 passed 525 unit tests, 270 browser tests, the production build and 26
engine tests. Visual inspection covered 64 rendered views in both themes at
375px and 1280px, including source links, schedule scores and the tall footer.
Texas Tech uses its white secondary color because black failed masthead contrast.
The producer rejected ambiguous defensive “rush” wording; explicit “pass rush”
passed fresh review. Availability reporting preserves the difference between a
coach’s expectation, a dated contingency plan and a confirmed game assignment.

Batch 3 registers the final 48 games and passes database readback for all twenty
programs. All 23 newly completed opponents have verified kickoff-day AP status.
The initial editions pass the same policy-3 source review, with five distinct
stories and four game watch points each. Maintenance reports no pending actions
or result checks for any of the twelve additions.

Batch 3 passed 563 unit tests, 296 browser tests, the production build, 26 engine
tests and 64 rendered-view inspections. The shared Brief heading now follows the
next game’s calendar day, so App State’s Friday game is labeled Friday. Its black
stage remains intentionally achromatic, with a separate gold accent; chromatic
teams retain the established saturation check. Request matching keeps the original
eight-team fixture and tests additions separately. The unavailable-team browser
scenario uses Toledo; a new regression verifies App State opens its live edition.

Boise State has a bye this week. Boise and Fresno include the official November
28 flex-game placeholders without inventing opponents. Unannounced networks remain
TBD. Sacramento State’s 2026 MAC/FBS membership was verified for Fresno’s schedule.
App State’s conflicting injury-feed labels remain attributed and do not become
clearance or a confirmed Friday starter. Tierney’s prior-game absence is not
presented as a confirmed San Diego State absence.

The homepage now presents a searchable directory grouped by conference, followed
by one live edition card. Conference groups and schools sort alphabetically;
counts and search aliases come from enabled team config. Native disclosures work
without JavaScript and keep one conference open at a time. Search reveals matches
directly, announces the result count, and offers a focused reset and request path.
The footer links back to the directory instead of repeating all twenty schools.

Homepage validation: `pnpm check` passed (563 tests), and `pnpm test:e2e` passed
(302 browser checks, including the production build). Visual review covered
48 default, expanded, search and empty states at 320, 375, 414, 768, 1280 and
1440 pixels in both themes. Keyboard navigation, aliases, conference search,
empty results and browsing without JavaScript passed. Tokenlock found no drift.
