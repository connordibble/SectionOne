import { matchesAnyName } from "@/lib/facts/team-names";
import type { ScheduleGame } from "@/lib/facts/schedule";
import { buildBracket, type BracketRound } from "./bracket";
import { nextPlayoffMilestone, postseasonTimeline, type PlayoffMilestone, type TimelineEntry } from "./calendar";
import type { CommitteeRanking } from "./committee";
import { teamPostseason, type OutlookInput, type TeamPostseason } from "./outlook";
import type { PostseasonSeason } from "./season";

export type CommitteeRow = CommitteeRanking["ranks"][number] & {
  isTeam?: boolean;
  // The ranked team is on this team's schedule: read from the team outward.
  opponent?: { site: ScheduleGame["site"]; status: ScheduleGame["status"]; result?: ScheduleGame["result"] };
};

// Everything the Postseason view renders, as plain data. Built on the server
// from sourced facts and handed to the client view; nothing in it is a guess.
export type PostseasonView = {
  outlook: TeamPostseason;
  today: string;
  nextMilestone?: PlayoffMilestone;
  committee?: Omit<CommitteeRanking, "ranks"> & { ranks: CommitteeRow[] };
  bracket: BracketRound[];
  timeline: TimelineEntry[];
  rules: Pick<PostseasonSeason["playoff"], "fieldSize" | "byes" | "championBids" | "groupBid" | "independentBids" | "sourceIds" | "selectionDay">
    & { firstRelease?: string };
  bowlRules: PostseasonSeason["bowls"];
  sources: PostseasonSeason["sources"];
  checkedAt: string;
};

export function postseasonView(input: OutlookInput): PostseasonView {
  const { season, committee, today, schedule } = input;
  const names = [input.team.shortName, input.team.displayName, ...input.team.aliases];
  const current = committee && committee.season === season.season ? committee : undefined;
  return {
    outlook: teamPostseason(input),
    today,
    nextMilestone: nextPlayoffMilestone(season, today, current),
    committee: current ? {
      ...current,
      ranks: current.ranks.map((row) => {
        const game = schedule.games.find((entry) => matchesAnyName([entry.opponent], row.team));
        return {
          ...row,
          ...(matchesAnyName(names, row.team) ? { isTeam: true } : {}),
          ...(game ? { opponent: { site: game.site, status: game.status, ...(game.result ? { result: game.result } : {}) } } : {}),
        };
      }),
    } : undefined,
    bracket: buildBracket(season, names),
    timeline: postseasonTimeline(season, today),
    rules: {
      fieldSize: season.playoff.fieldSize, byes: season.playoff.byes, championBids: season.playoff.championBids,
      groupBid: season.playoff.groupBid, independentBids: season.playoff.independentBids, sourceIds: season.playoff.sourceIds,
      selectionDay: season.playoff.selectionDay, firstRelease: season.playoff.rankings[0]?.date,
    },
    bowlRules: season.bowls,
    sources: season.sources,
    checkedAt: season.checkedAt,
  };
}
