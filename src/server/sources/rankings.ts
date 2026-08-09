import type { TeamConfig } from "@/config/team";
import { getTeamSchedule, type ScheduleSite } from "@/server/schedule/schedule";
import preseason2026 from "../../../data/fixtures/polls/2026-preseason.json";
import { createSourceDocumentId } from "./ids";
import type { SourceDocument } from "./types";

export type PollEntry = { rank: number; team: string };

export type Poll = {
  id: string;
  name: string;
  releasedAt: string;
  sourceUrl: string;
  ranks: PollEntry[];
};

export type PendingPoll = {
  id: string;
  name: string;
  expectedAt: string;
  expectedLabel: string;
};

export type PollWeek = {
  season: number;
  week: number;
  weekLabel: string;
  capturedAt: string;
  polls: Poll[];
  pending: PendingPoll[];
};

export type RankedOpponent = {
  opponent: string;
  rank: number;
  site: ScheduleSite;
  dateLabel: string;
};

export type TeamRankingSummary = {
  poll: Poll;
  weekLabel: string;
  // Null means genuinely unranked, which is the normal case for most of the
  // country and must not be dressed up as anything else.
  teamRank: number | null;
  rankedOpponents: RankedOpponent[];
  opponentCount: number;
  pending: PendingPoll[];
};

const pollWeeks: PollWeek[] = [preseason2026 as PollWeek];

export function getPollWeek(season: number): PollWeek | undefined {
  return pollWeeks.find((week) => week.season === season);
}

// The team's own view of the field, not a generic top 25.
//
// A ranked team wants its number. An unranked team — most of them — wants to
// know which weeks on its schedule are the hard ones, and a national list
// answers that only if the fan cross-references it themselves. Deriving the
// opponent view from the team's own schedule is the part that makes this
// section worth reading for a Sun Belt fan and not just an SEC one.
export function getTeamRankingSummary(team: TeamConfig): TeamRankingSummary | undefined {
  const season = team.cfbd?.season ?? getTeamSchedule(team.slug)?.seasonYear;
  const week = season === undefined ? undefined : getPollWeek(season);
  const poll = week?.polls[0];

  if (!week || !poll) {
    return undefined;
  }

  const rankByTeam = new Map(poll.ranks.map((entry) => [normalize(entry.team), entry.rank]));
  const schedule = getTeamSchedule(team.slug);
  const games = schedule?.games ?? [];

  const rankedOpponents = games.flatMap((game) => {
    const rank = rankByTeam.get(normalize(game.opponent));

    return rank === undefined
      ? []
      : [{ opponent: game.opponent, rank, site: game.site, dateLabel: game.dateLabel }];
  });

  return {
    poll,
    weekLabel: week.weekLabel,
    teamRank: resolveTeamRank(team, rankByTeam),
    // Hardest first: the question behind this list is how heavy the season is,
    // and a fan reads the top of it and stops.
    rankedOpponents: rankedOpponents.sort((left, right) => left.rank - right.rank),
    opponentCount: games.length,
    pending: week.pending,
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

  const opponents =
    summary.rankedOpponents.length === 0
      ? "No ranked opponents on the schedule."
      : `Ranked opponents: ${summary.rankedOpponents
          .map((opponent) => `No. ${opponent.rank} ${opponent.opponent} (${opponent.dateLabel})`)
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
      body: `${standing} ${opponents} ${pending}`.trim(),
      metadata: {
        pollId: summary.poll.id,
        teamRank: summary.teamRank,
        rankedOpponentCount: summary.rankedOpponents.length,
      },
      publishedAt: summary.poll.releasedAt,
      fetchedAt: summary.poll.releasedAt,
    },
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
