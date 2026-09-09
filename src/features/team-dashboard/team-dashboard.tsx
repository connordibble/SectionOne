import { getLatestPollWeek } from "@/server/facts/live-poll";
import { withPollSnapshot } from "@/server/facts/poll-snapshot";
import type { CSSProperties } from "react";
import {
  createThemeStyle,
  enabledTeamSlugs,
  getTeamConfig,
  type TeamConfig,
} from "@/config/team";
import {
  formatCaptureDate,
  getKickoffCountdown,
  getNextGame,
  getTeamSchedule,
} from "@/server/schedule/schedule";
import { getTeamNoteDocuments } from "@/server/sources/notes";
import { getTeamRankingSummary } from "@/server/sources/rankings";
import { getWeeklyEdition } from "@/server/sources/weekly";
import { TeamWorkspace } from "./team-workspace";

type TeamDashboardProps = {
  team: TeamConfig;
};

export async function TeamDashboard({ team }: TeamDashboardProps) {
  const nextGame = getNextGame(team.slug);
  const schedule = getTeamSchedule(team.slug);
  const poll = schedule ? await getLatestPollWeek(schedule.seasonYear) : undefined;
  const ranking = withPollSnapshot(poll, () => getTeamRankingSummary(team));
  const noteDocuments = getTeamNoteDocuments(team.slug);
  const notesById = new Map(
    noteDocuments.map((document) => [String(document.metadata.noteId), document]),
  );

  const signals = team.editorial.signals.map((signal) => ({
    ...signal,
    sourceTitle: notesById.get(signal.noteId)?.title ?? "Section One note",
  }));
  const starterCitations = team.editorial.matchup.citationNoteIds.flatMap((noteId) => {
    const document = notesById.get(noteId);

    return document
      ? [
          {
            id: document.id,
            title: document.title,
            sourceUrl: document.sourceUrl,
            provider: document.provider,
          },
        ]
      : [];
  });

  const teamOptions = enabledTeamSlugs.flatMap((slug) => {
    const option = getTeamConfig(slug);

    return option
      ? [{ slug: option.slug, shortName: option.shortName, conference: option.conference }]
      : [];
  });

  return (
    <TeamWorkspace
      countdown={getKickoffCountdown(nextGame, new Date(), team.timeZone)}
      leadSourceTitle={
        notesById.get(team.editorial.lead.noteId)?.title ?? "Section One note"
      }
      nextGame={nextGame}
      ranking={ranking}
      schedule={schedule}
      scheduleCapturedLabel={schedule ? formatCaptureDate(schedule.capturedAt) : undefined}
      signals={signals}
      starterCitations={starterCitations}
      team={team}
      teamOptions={teamOptions}
      themeStyle={createTeamThemeStyle(team)}
      weekly={getWeeklyEdition(team.slug)}
    />
  );
}

function createTeamThemeStyle(team: TeamConfig): CSSProperties {
  return createThemeStyle(team.theme) as CSSProperties;
}
