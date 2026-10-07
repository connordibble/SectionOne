# Postseason: playoff race and bowl fallback

Every edition has a **Postseason** view, the fourth tab beside Brief, Matchup and Schedule
(`/teams/<slug>#postseason`): a race board with the team's standing, the next date and the
bowl ladder; the committee's top 25 read from the team outward; the published bracket; the
rules; and the calendar. The Brief's standing rail carries a one-line summary that opens it.
Both read the same engine and the same wording (`src/lib/postseason/copy.ts`), so a state
never reads two ways. `DESIGN.md` § Postseason covers the composition. This answers [issue #14](https://github.com/connordibble/SectionOne/issues/14),
with one deliberate change from how it was first written, described next.

## No probabilities, and why the 5% trigger went away

The issue proposed switching to a bowl tracker when a sourced playoff probability fell
below 5%. No source we can use supplies one:

- CollegeFootballData publishes ratings and per-game win probabilities but no playoff odds.
- ESPN FPI does, but only through the same unofficial endpoint the AP poll already relies
  on, so it would stack a second rights question on one that is still open
  (`docs/future-work.md` § Settle commercial rights before revenue).
- SP+ odds are paywalled. A model of our own would be a forecast with our name on it.

A probability threshold also flickers week to week, and providers round (`<1%`), so the
"exactly 5%" rule could not be applied to the published number anyway.

The trigger is a stated display rule instead, built from facts the page already shows:

| Phase | "In the picture" |
| --- | --- |
| Before the committee's first ranking | Ranked in the AP poll, or no more than `contentionLossLimit` (2) losses |
| Committee rankings published | In the committee's top 25 |
| Field announced | In the field (confirmed) |

In the picture → the section leads with the playoff race. Otherwise it leads with the
bowl race, and the playoff rows (standing and path) stay underneath. The page says what
the rule is and that it is not a forecast. If a usable probability source is ever cleared,
it belongs beside this as display-only context, never as the trigger.

## Data

| Fact | Where | How it updates |
| --- | --- | --- |
| Format, bracket, calendar, bowl standard | `data/facts/postseason/<season>.json` | By hand once a season, from the sources named in the file |
| Committee top 25 | ESPN rankings feed (`type: "cfp"`) verified against NCAA.com's CFP table | Runtime refresh, 15 min per process, from the first scheduled release |
| Record, games left | Edition schedule results | Existing schedule refresh |
| FBS / FCS opponent | `opponentClassification` on schedule games | CFBD builder; carried forward on official imports |
| AP rank | Existing AP snapshot | Existing poll refresh |
| Confirmed field and bowl picks | `confirmed` block of the season file | By hand on Selection Day weekend, with source links |

The season file is schema-checked (`src/lib/postseason/season.ts`): every rule block names
its sources, ranking dates must be in order and end on Selection Day, and a confirmed
field must list every seed once, and the bracket must hold every seed exactly once with each
quarterfinal fed by one first-round game. A season with no file renders no Postseason tab
and no summary; last year's format is never carried forward.

### Committee rankings

`src/server/facts/committee-provider.ts` follows the AP adapter's rule: both published
versions must agree on every rank, school and record, the NCAA "Through Games" date must
be at most four days before the release, and the table must be complete. No model
supplies a rank, record or name. A feed with no `cfp` entry, or one from another season,
means "not released" and is not reported as a failure.

`createCommitteeRefresher` keeps the last good ranking through failures, refuses a
regression, and reports `degraded` (log only) on a rejected refresh. Before the first
scheduled release it does not fetch at all. `data/facts/cfp-rankings.json` is the bundled
cold-start fallback; refresh it with `pnpm committee:refresh <season>`.

When a scheduled release date has passed without a verified ranking for it, both surfaces
say so ("The Tue, Nov 10 committee rankings have not been checked yet") rather than
presenting the older ranking as current.

### Bowl eligibility

Counted wins are a lower bound. FBS wins count; at most `maxCountedFcsWins` (1) FCS win
counts; lower-division wins do not. An **unclassified** opponent is never assumed FBS:
a team that reaches six only by counting one shows "not been confirmed to count" instead
of "eligible". A final without a confirmed score counts as neither a win nor a loss.
Schedules longer than `regularSeasonGames` report eligibility as unknown, because the
13-game exception is not encoded. "Eligible" never implies an invitation; a destination
appears only from a confirmed selection with a source link.

## Season operator checklist

Recurring work is per season and per Selection Day, not per reader or per edition.

1. **Before the season:** add `data/facts/postseason/<season>.json` from the official
   format, rankings calendar, round dates and the bowl standard, and import it in
   `src/server/postseason/postseason.ts`. Set `checkedAt` to when you checked.
2. **First committee release:** confirm an edition's Postseason tab shows the ranking. If it shows "not
   checked yet", read the `facts/committee` degradations: a feed shape change must be
   fixed in the adapter, never by loosening the agreement checks.
3. **Selection Day:** fill `confirmed.playoffField` (seeds, bid type, source URL) and
   `confirmed.bowlSelections` for edition teams, then run `pnpm check`.

## Known gaps

- **Conference standings.** The path line states each conference's rule ("Win the SEC and
  the bid is automatic"), but the page does not yet know whether a team is still alive in
  its conference race. That needs a standings source and published clinch status; do not
  compute tiebreakers.
- **Highest-ranked Group of 6 team.** The committee table has no conferences, so the page
  does not yet name who currently holds that bid.
- **Bowl tie-ins.** Conference tie-ins would be honest, sourced context for "where could we
  go" but are not encoded yet. Media bowl projections are deliberately excluded.
- **The live `cfp` feed entry's shape** is inferred from ESPN's core API and its AP
  entries; the verification fixture is the real NCAA.com table through Dec 6, 2025. The
  first live release (Nov 3, 2026) is the real test. A mismatch fails closed.
- **FCS scholarship threshold.** A win over an FCS program below the scholarship minimum
  does not count; classification does not carry that detail.
- **Committee snapshots are per process.** Unlike the AP poll there is no database row, so
  a cold instance falls back to the bundled file until its first refresh.
- **Chat** does not yet read postseason facts. Adding them means adding them to
  `corpusVersion()` in the same change (`docs/engineering-standards.md` § 9).
