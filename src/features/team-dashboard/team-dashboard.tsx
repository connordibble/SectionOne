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
import { TeamWorkspace } from "./team-workspace";

type TeamDashboardProps = {
  team: TeamConfig;
};

export function TeamDashboard({ team }: TeamDashboardProps) {
  const nextGame = getNextGame(team.slug);
  const schedule = getTeamSchedule(team.slug);
  const noteDocuments = getTeamNoteDocuments(team.slug);
  const notesById = new Map(
    noteDocuments.map((document) => [String(document.metadata.noteId), document]),
  );

  const signals = team.editorial.signals.map((signal) => ({
    ...signal,
    sourceTitle: notesById.get(signal.noteId)?.title ?? "Saturday Signal note",
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
      ? [{ slug: option.slug, shortName: option.shortName }]
      : [];
  });

  return (
    <TeamWorkspace
      countdown={getKickoffCountdown(nextGame)}
      leadSourceTitle={
        notesById.get(team.editorial.lead.noteId)?.title ?? "Saturday Signal note"
      }
      nextGame={nextGame}
      schedule={schedule}
      scheduleCapturedLabel={schedule ? formatCaptureDate(schedule.capturedAt) : undefined}
      signals={signals}
      starterCitations={starterCitations}
      team={team}
      teamOptions={teamOptions}
      themeStyle={createTeamThemeStyle(team)}
    />
  );
}

function createTeamThemeStyle(team: TeamConfig): CSSProperties {
  return createThemeStyle(team.theme) as CSSProperties;
}
