import type { TeamConfig } from "@/config/team";
import { getTeamSchedule, type ScheduleSite } from "@/server/schedule/schedule";
import { getPollSnapshot } from "@/server/facts/poll-snapshot";
import type { Poll, PollWeek, PendingPoll } from "@/lib/facts/poll";
export type { Poll, PollWeek, PollEntry, PendingPoll } from "@/lib/facts/poll";
import { createSourceDocumentId } from "./ids";
import type { SourceDocument } from "./types";
import { calendarDate, rankedGamePhase, type RankedGamePhase, type ScheduleGame } from "@/lib/facts/schedule";

export type RankedOpponent = {
  gameId: string;
  opponent: string;
  rank: number;
  site: ScheduleSite;
  dateLabel: string;
  status: ScheduleGame["status"];
  phase: RankedGamePhase;
  result?: ScheduleGame["result"];
  rankSourceUrl?: string;
};

export type TeamRankingSummary = {
  poll: Poll;
  weekLabel: string;
  // Null means genuinely unranked, which is the normal case for most of the
  // country and must not be dressed up as anything else.
  teamRank: number | null;
  rankedOpponents: RankedOpponent[];
  opponentCount: number;
  missingGameDayRanks?: number;
  pending: PendingPoll[];
  checkedAt: string;
  scheduleSource?: { url: string; checkedAt: string };
};

export function getPollWeek(season: number): PollWeek | undefined {
  return getPollSnapshot(season);
}

// The team's own view of the field, not a generic top 25.
//
// A ranked team wants its number. An unranked team — most of them — wants to
// know which weeks on its schedule are the hard ones, and a national list
// answers that only if the fan cross-references it themselves. Deriving the
// opponent view from the team's own schedule is the part that makes this
// section worth reading for a Sun Belt fan and not just an SEC one.
export function getTeamRankingSummary(team: TeamConfig, now = new Date()): TeamRankingSummary | undefined {
  const season = team.cfbd?.season ?? getTeamSchedule(team.slug)?.seasonYear;
  const week = season === undefined ? undefined : getPollWeek(season);
  const poll = week?.polls[0];

  if (!week || !poll) {
    return undefined;
  }

  const rankByTeam = new Map(poll.ranks.map((entry) => [normalize(entry.team), entry.rank]));
  const schedule = getTeamSchedule(team.slug);
  const games = schedule?.games ?? [];
  const today = calendarDate(now, schedule?.timeZone ?? team.timeZone);

  const rankedOpponents = games.flatMap((game) => {
    const phase = rankedGamePhase(game, today);
    // Once a game starts, today's poll cannot rewrite what the opponent was.
    const useGameDay = phase !== "upcoming";
    const historical = game.opponentRankAtKickoff;
    const rank = useGameDay ? historical?.rank ?? undefined : rankByTeam.get(normalize(game.opponent));

    return rank === undefined
      ? []
      : [{ gameId: game.id, opponent: game.opponent, rank, site: game.site, dateLabel: game.dateLabel,
          status: game.status, phase, result: game.result, rankSourceUrl: useGameDay ? historical?.sourceUrl : undefined }];
  });

  return {
    poll,
    weekLabel: week.weekLabel,
    teamRank: resolveTeamRank(team, rankByTeam),
    // Hardest first: the question behind this list is how heavy the season is,
    // and a fan reads the top of it and stops.
    rankedOpponents: rankedOpponents.sort((left, right) => left.rank - right.rank),
    opponentCount: games.length,
    missingGameDayRanks: games.filter((game) => game.status !== "cancelled" && rankedGamePhase(game, today) !== "upcoming" && !game.opponentRankAtKickoff).length,
    pending: week.pending,
    checkedAt: week.capturedAt,
    scheduleSource: schedule ? { url: schedule.sourceUrl, checkedAt: schedule.capturedAt } : undefined,
  };
}

// One document per team, not one per ranked school: a fan asks "are we ranked"
// and "who on our schedule is ranked", and both are answered by the team's own
// view of the poll.
export function getRankingDocuments(team: TeamConfig): SourceDocument[] {
  const summary = getTeamRankingSummary(team);

  if (!summary) {
    return [];
  }

  const standing =
    summary.teamRank === null
      ? `${team.shortName} is not ranked in the ${summary.poll.name}.`
      : `${team.shortName} is No. ${summary.teamRank} in the ${summary.poll.name}.`;

  const upcoming = summary.rankedOpponents.filter((opponent) => opponent.phase === "upcoming");
  const opponents =
    upcoming.length === 0
      ? "No upcoming opponents are ranked in this poll."
      : `Ranked opponents: ${upcoming
          .map((opponent) => `No. ${opponent.rank} ${opponent.opponent} (${opponent.dateLabel}; ${opponent.phase === "upcoming" ? "current AP rank" : "AP rank at kickoff"})`)
          .join("; ")}.`;

  const pending = summary.pending
    .map((poll) => `The ${poll.name} is not out yet; it is expected ${poll.expectedLabel}.`)
    .join(" ");

  return [
    {
      id: createSourceDocumentId([team.slug, "ranking", summary.poll.id, summary.weekLabel]),
      teamSlug: team.slug,
      provider: "press",
      sourceType: "ranking",
      sourceUrl: summary.poll.sourceUrl,
      title: `${summary.poll.name}: ${summary.weekLabel}`,
      body: `${standing} ${opponents} Upcoming opponents use the current AP poll; played opponents use AP rankings at kickoff. ${summary.missingGameDayRanks ? `${summary.missingGameDayRanks} game-day rankings are not yet verified.` : ""} ${pending} Poll: ${summary.weekLabel}, published ${summary.poll.releasedAt.slice(0, 10)}.`.trim(),
      metadata: {
        pollId: summary.poll.id,
        teamRank: summary.teamRank,
        rankedOpponentCount: summary.rankedOpponents.length,
      },
      publishedAt: summary.poll.releasedAt,
      fetchedAt: summary.checkedAt,
    },
    ...summary.rankedOpponents.filter((opponent) => opponent.phase !== "upcoming" && opponent.rankSourceUrl).map((opponent): SourceDocument => ({
      id: createSourceDocumentId([team.slug, "game-day-ranking", opponent.gameId]),
      teamSlug: team.slug, provider: "press", sourceType: "ranking", sourceUrl: opponent.rankSourceUrl!,
      title: `AP rank at kickoff: ${opponent.opponent}, ${opponent.dateLabel}`,
      body: `${team.shortName} played No. ${opponent.rank} ${opponent.opponent} (${opponent.dateLabel}), using the AP rank at kickoff, not today's poll.${opponent.result ? ` Final score from ${team.shortName}'s perspective: ${opponent.result.teamScore}-${opponent.result.opponentScore}.` : ""}`,
      metadata: { pollId: "ap", gameId: opponent.gameId, opponentRankAtKickoff: opponent.rank },
      publishedAt: getTeamSchedule(team.slug)?.games.find((game) => game.id === opponent.gameId)?.date ?? summary.poll.releasedAt,
      fetchedAt: getTeamSchedule(team.slug)?.games.find((game) => game.id === opponent.gameId)?.opponentRankAtKickoff?.checkedAt ?? summary.checkedAt,
    })),
  ];
}

// Polls list a school the way the pollster writes it, which may be any of the
// names the config already knows the team by.
function resolveTeamRank(team: TeamConfig, rankByTeam: Map<string, number>): number | null {
  for (const name of [team.shortName, team.displayName, ...team.aliases]) {
    const rank = rankByTeam.get(normalize(name));

    if (rank !== undefined) {
      return rank;
    }
  }

  return null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
