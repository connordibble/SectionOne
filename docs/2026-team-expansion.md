# 2026 team expansion

The authorized expansion adds twelve programs to the existing eight, in three
batches of four. Each batch uses the private producer's reviewed onboarding
package and the public app's shared team and edition contracts.

| Batch | Programs | State |
| --- | --- | --- |
| 1 | Notre Dame, Michigan, Penn State, Miami | Activated and verified |
| 2 | Tennessee, BYU, Texas Tech, Indiana | Pending |
| 3 | Boise State, James Madison, App State, Fresno State | Pending |

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

After batch 3, revise the homepage edition directory. The user wants fewer cards
presented at once and a clearer way to choose among twenty teams. Preserve the
card design where useful; evaluate a compact team chooser grouped by conference
and a small set of quick-access cards. Verify keyboard use, both themes, mobile
and desktop layouts, and access to every enabled edition before committing that
separate UX change.
