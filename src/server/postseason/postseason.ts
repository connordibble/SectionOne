import season2026 from "../../../data/facts/postseason/2026.json";
import type { TeamConfig } from "@/config/team";
import { calendarDate } from "@/lib/facts/schedule";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { teamPostseason, type TeamPostseason } from "@/lib/postseason/outlook";
import { postseasonSeasonSchema, type PostseasonSeason } from "@/lib/postseason/season";
import { getLatestCommitteeRanking } from "@/server/facts/live-committee";
import { getTeamSchedule } from "@/server/schedule/schedule";

// One file per season. A season without one renders no postseason section
// rather than carrying last year's format forward.
const seasons = new Map<number, PostseasonSeason>(
  [season2026].map((file) => {
    const parsed = postseasonSeasonSchema.parse(file);
    return [parsed.season, parsed];
  }),
);

export function getPostseasonSeason(season: number): PostseasonSeason | undefined {
  return seasons.get(season);
}

export async function getCommitteeRanking(season: PostseasonSeason, today: string): Promise<CommitteeRanking | undefined> {
  return getLatestCommitteeRanking(season.season, season.playoff.rankings[0]?.date, today);
}

// `apRank` is passed in: the edition already resolved it from the poll it
// renders, and undefined means the poll could not be read, not "unranked".
export async function getTeamPostseason(team: TeamConfig, apRank: number | null | undefined, now = new Date()): Promise<TeamPostseason | undefined> {
  const schedule = getTeamSchedule(team.slug);
  const season = schedule ? getPostseasonSeason(schedule.seasonYear) : undefined;
  if (!schedule || !season) return undefined;
  const today = calendarDate(now, schedule.timeZone);
  const committee = await getCommitteeRanking(season, today);
  return teamPostseason({ team, schedule, season, committee, apRank, today });
}

export type PlayoffMilestone = { date: string; label: string };

export type PlayoffTracker = {
  season: PostseasonSeason;
  today: string;
  committee?: CommitteeRanking;
  nextMilestone?: PlayoffMilestone;
  // A scheduled release that has passed without a verified ranking.
  rankingBehind?: PlayoffMilestone;
  editions: Array<{ team: TeamConfig; outlook: TeamPostseason }>;
};

// The national page reads the calendar in Eastern time: every committee
// release and Selection Day is scheduled and announced in ET.
const nationalZone = "America/New_York";

export function nextPlayoffMilestone(season: PostseasonSeason, today: string, committee?: CommitteeRanking): PlayoffMilestone | undefined {
  const releases = season.playoff.rankings.filter((release) => !committee || release.date > committee.releasedAt);
  // Every game day counts: a round spread over two days is still on during its
  // second, and the clock must not jump past games being played.
  const games = season.playoff.rounds.flatMap((round) => round.dates.map((date) => ({ date, label: round.name })));
  return [...(season.confirmed.playoffField ? [] : releases), ...games]
    .filter((milestone) => milestone.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export async function getPlayoffTracker(
  teams: TeamConfig[],
  apRankFor: (team: TeamConfig) => number | null | undefined,
  now = new Date(),
): Promise<PlayoffTracker | undefined> {
  const seasonYear = Math.max(...teams.flatMap((team) => getTeamSchedule(team.slug)?.seasonYear ?? []));
  const season = Number.isFinite(seasonYear) ? getPostseasonSeason(seasonYear) : undefined;
  if (!season) return undefined;
  const today = calendarDate(now, nationalZone);
  const committee = await getCommitteeRanking(season, today);
  const editions = (await Promise.all(teams.map(async (team) => {
    const outlook = await getTeamPostseason(team, apRankFor(team), now);
    return outlook?.season === season.season ? [{ team, outlook }] : [];
  }))).flat();
  const rankingBehind = season.confirmed.playoffField ? undefined : season.playoff.rankings
    .filter((release) => release.date < today && (!committee || release.date > committee.releasedAt)).at(-1);
  return { season, today, committee, nextMilestone: nextPlayoffMilestone(season, today, committee), rankingBehind, editions };
}
