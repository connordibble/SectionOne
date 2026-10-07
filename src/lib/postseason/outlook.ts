import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import { matchesAnyName, teamNameKey } from "@/lib/facts/team-names";
import type { CommitteeRanking } from "./committee";
import type { BowlSelection, PlayoffSeed, PostseasonSeason } from "./season";

// Before the committee publishes, "in the picture" is a stated display rule,
// not a forecast: ranked in the AP poll, or no more than this many losses. No
// at-large team in the 12-team era has carried three regular-season losses, so
// a team past it leads with the bowl race while its playoff path stays on the
// page. Once the committee ranks teams, its top 25 replaces this rule.
export const contentionLossLimit = 2;

export type SeasonRecord = {
  wins: number;
  losses: number;
  // Games marked final whose score has not been confirmed. They count toward
  // nothing until it is, and are never treated as a win or a loss.
  pendingResults: number;
  remainingGames: number;
};

export type BowlState = "selected" | "eligible" | "unconfirmed" | "alive" | "out" | "unknown";

export type BowlOutlook = {
  state: BowlState;
  winsRequired: number;
  countedWins: number;
  winsNeeded: number;
  gamesLeft: number;
  // Remaining games that could still add a counted win.
  countableGamesLeft: number;
  extraFcsWins: number;
  unclassifiedWins: number;
  alternateStillPossible: boolean;
  alternates: PostseasonSeason["bowls"]["alternates"];
  selection?: BowlSelection;
};

export type PlayoffPhase = "before-rankings" | "rankings" | "field-set";
export type PlayoffStanding = "in-field" | "not-selected" | "in-picture" | "outside";
export type PlayoffPath = "champion" | "group" | "independent" | "at-large";

export type PlayoffOutlook = {
  phase: PlayoffPhase;
  standing: PlayoffStanding;
  path: PlayoffPath;
  conference: string;
  groupLabel: string;
  fieldSize: number;
  byes: number;
  committeeRank: number | null;
  // Undefined when no poll could be read: unknown, not unranked.
  apRank?: number | null;
  ranking?: { weekLabel: string; releasedAt: string; sourceUrl: string };
  // A scheduled release has passed without a verified ranking for it.
  rankingBehind?: { date: string; label: string };
  nextRanking?: { date: string; label: string };
  seed?: PlayoffSeed;
  fieldAnnouncedAt?: string;
  fieldSourceUrl?: string;
};

export type TeamPostseason = {
  season: number;
  slug: string;
  shortName: string;
  lead: "playoff" | "bowl";
  record: SeasonRecord;
  playoff: PlayoffOutlook;
  bowl: BowlOutlook;
  rulesCheckedAt: string;
  rulesSources: PostseasonSeason["sources"];
  scheduleCheckedAt: string;
  scheduleSourceUrl: string;
};

export type OutlookInput = {
  team: { slug: string; shortName: string; displayName: string; aliases: readonly string[]; conference: string };
  schedule: TeamSchedule;
  season: PostseasonSeason;
  committee?: CommitteeRanking;
  apRank?: number | null;
  // The calendar date in the team's zone, YYYY-MM-DD.
  today: string;
};

const remainingStatuses = new Set<ScheduleGame["status"]>(["scheduled", "in-progress", "postponed"]);

export function seasonRecord(schedule: TeamSchedule): SeasonRecord {
  let wins = 0, losses = 0, pendingResults = 0, remainingGames = 0;
  for (const game of schedule.games) {
    if (game.status === "final" && game.result) {
      if (game.result.teamScore > game.result.opponentScore) wins += 1;
      else if (game.result.teamScore < game.result.opponentScore) losses += 1;
    } else if (game.status === "final") pendingResults += 1;
    else if (remainingStatuses.has(game.status)) remainingGames += 1;
  }
  return { wins, losses, pendingResults, remainingGames };
}

// Counted wins are a lower bound. An unclassified opponent is never assumed to
// be FBS: a win that might not count leaves the team "unconfirmed" rather than
// eligible, because overstating eligibility is the error a fan acts on.
export function bowlOutlook(schedule: TeamSchedule, rules: PostseasonSeason["bowls"], selection?: BowlSelection): BowlOutlook {
  let fbsWins = 0, fcsWins = 0, unclassifiedWins = 0;
  let fbsLeft = 0, fcsLeft = 0, unclassifiedLeft = 0, gamesLeft = 0;
  for (const game of schedule.games) {
    const won = game.status === "final" && game.result && game.result.teamScore > game.result.opponentScore;
    const open = remainingStatuses.has(game.status) || (game.status === "final" && !game.result);
    const kind = game.opponentClassification;
    if (won) {
      if (kind === "fbs") fbsWins += 1;
      else if (kind === "fcs") fcsWins += 1;
      else if (kind === undefined) unclassifiedWins += 1;
    } else if (open) {
      gamesLeft += 1;
      if (kind === "fbs") fbsLeft += 1;
      else if (kind === "fcs") fcsLeft += 1;
      else if (kind === undefined) unclassifiedLeft += 1;
    }
  }
  const cap = rules.maxCountedFcsWins;
  const countedFcs = Math.min(cap, fcsWins);
  const countedWins = fbsWins + countedFcs;
  const fcsRoom = Math.min(fcsLeft, cap - countedFcs);
  const countableGamesLeft = fbsLeft + unclassifiedLeft + fcsRoom;
  const best = countedWins + unclassifiedWins + countableGamesLeft;
  const record = seasonRecord(schedule);
  const base = {
    winsRequired: rules.winsRequired,
    countedWins,
    winsNeeded: Math.max(0, rules.winsRequired - countedWins),
    gamesLeft,
    countableGamesLeft,
    extraFcsWins: fcsWins - countedFcs,
    unclassifiedWins,
    alternates: rules.alternates,
    // Total wins are what the 5-7 exception reads, not counted wins.
    alternateStillPossible: record.wins + record.remainingGames + record.pendingResults >= rules.alternates.wins
      && record.losses <= rules.alternates.losses,
  };
  if (selection) return { ...base, state: "selected", selection };
  const regularSeasonGames = schedule.games.filter((game) => game.status !== "cancelled").length;
  if (regularSeasonGames > rules.regularSeasonGames) return { ...base, state: "unknown" };
  if (countedWins >= rules.winsRequired) return { ...base, state: "eligible", winsNeeded: 0 };
  if (countedWins + unclassifiedWins >= rules.winsRequired) return { ...base, state: "unconfirmed" };
  if (best >= rules.winsRequired) return { ...base, state: "alive" };
  return { ...base, state: "out" };
}

function playoffPath(input: OutlookInput): PlayoffPath {
  const { season, team } = input;
  const conference = teamNameKey(team.conference);
  if (season.playoff.championBids.some((name) => teamNameKey(name) === conference)) return "champion";
  if (season.playoff.groupBid.conferences.some((name) => teamNameKey(name) === conference)) return "group";
  if (season.playoff.independentBids.some((bid) => matchesAnyName(teamNames(team), bid.team))) return "independent";
  return "at-large";
}

function teamNames(team: OutlookInput["team"]): string[] {
  return [team.shortName, team.displayName, ...team.aliases];
}

export function playoffOutlook(input: OutlookInput, record: SeasonRecord): PlayoffOutlook {
  const { season, committee, today } = input;
  const names = teamNames(input.team);
  const releases = season.playoff.rankings;
  const base = {
    path: playoffPath(input),
    conference: input.team.conference,
    groupLabel: season.playoff.groupBid.label,
    fieldSize: season.playoff.fieldSize,
    byes: season.playoff.byes,
    apRank: input.apRank,
  };
  const field = season.confirmed.playoffField;
  if (field) {
    const seed = field.seeds.find((entry) => matchesAnyName(names, entry.team));
    return {
      ...base, phase: "field-set", standing: seed ? "in-field" : "not-selected",
      committeeRank: rankIn(committee, names), seed, fieldAnnouncedAt: field.announcedAt, fieldSourceUrl: field.sourceUrl,
    };
  }
  const current = committee && committee.season === season.season ? committee : undefined;
  // A release scheduled for today may not be out yet (they air in the evening),
  // so only a date strictly before today counts as missed.
  const missed = releases.filter((release) => release.date < today && (!current || release.date > current.releasedAt)).at(-1);
  const nextRanking = releases.find((release) => release.date >= today && (!current || release.date > current.releasedAt));
  if (!current) {
    const inPicture = (input.apRank !== undefined && input.apRank !== null) || record.losses <= contentionLossLimit;
    return {
      ...base, phase: "before-rankings", standing: inPicture ? "in-picture" : "outside",
      committeeRank: null, rankingBehind: missed, nextRanking,
    };
  }
  const committeeRank = rankIn(current, names);
  return {
    ...base, phase: "rankings", standing: committeeRank === null ? "outside" : "in-picture", committeeRank,
    ranking: { weekLabel: current.weekLabel, releasedAt: current.releasedAt, sourceUrl: current.sourceUrl },
    rankingBehind: missed, nextRanking,
  };
}

function rankIn(ranking: CommitteeRanking | undefined, names: string[]): number | null {
  return ranking?.ranks.find((row) => matchesAnyName(names, row.team))?.rank ?? null;
}

export function teamPostseason(input: OutlookInput): TeamPostseason {
  const record = seasonRecord(input.schedule);
  const names = teamNames(input.team);
  const selection = input.season.confirmed.bowlSelections.find((entry) => matchesAnyName(names, entry.team));
  const playoff = playoffOutlook(input, record);
  const bowl = bowlOutlook(input.schedule, input.season.bowls, playoff.standing === "in-field" ? undefined : selection);
  const lead = playoff.standing === "in-field" || playoff.standing === "in-picture" ? "playoff" : "bowl";
  return {
    season: input.season.season,
    slug: input.team.slug,
    shortName: input.team.shortName,
    lead,
    record,
    playoff,
    bowl,
    rulesCheckedAt: input.season.checkedAt,
    rulesSources: input.season.sources,
    scheduleCheckedAt: input.schedule.provenance?.officialVerifiedAt ?? input.schedule.capturedAt,
    scheduleSourceUrl: input.schedule.sourceUrl,
  };
}

export type FirstRoundGame = { higher: PlayoffSeed; lower: PlayoffSeed };

// Seeds outside the bye line meet outside-in: 5 v 12, 6 v 11, and so on.
export function firstRoundPairs(seeds: readonly PlayoffSeed[], byes: number): FirstRoundGame[] {
  const ordered = [...seeds].sort((a, b) => a.seed - b.seed).slice(byes);
  const pairs: FirstRoundGame[] = [];
  for (let index = 0; index < Math.floor(ordered.length / 2); index += 1) {
    pairs.push({ higher: ordered[index], lower: ordered[ordered.length - 1 - index] });
  }
  return pairs;
}
