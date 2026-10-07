import season2026 from "../../../data/facts/postseason/2026.json";
import type { TeamConfig } from "@/config/team";
import { calendarDate } from "@/lib/facts/schedule";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { postseasonSeasonSchema, type PostseasonSeason } from "@/lib/postseason/season";
import { postseasonView, type PostseasonView } from "@/lib/postseason/view";
import { getLatestCommitteeRanking } from "@/server/facts/live-committee";
import { getTeamSchedule } from "@/server/schedule/schedule";

// One file per season. A season without one renders no postseason view
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
export async function getTeamPostseasonView(team: TeamConfig, apRank: number | null | undefined, now = new Date()): Promise<PostseasonView | undefined> {
  const schedule = getTeamSchedule(team.slug);
  const season = schedule ? getPostseasonSeason(schedule.seasonYear) : undefined;
  if (!schedule || !season) return undefined;
  const today = calendarDate(now, schedule.timeZone);
  const committee = await getCommitteeRanking(season, today);
  return postseasonView({ team, schedule, season, committee, apRank, today });
}
