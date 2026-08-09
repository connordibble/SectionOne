import type { CSSProperties } from "react";
import {
  deriveTeamPalettes,
  enabledTeamSlugs,
  getSourceReadiness,
  getTeamConfig,
  type TeamConfig,
  type TeamPalette,
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
  const sourceStates = getSourceReadiness(team);
  const noteDocuments = getTeamNoteDocuments(team.slug);
  const notesById = new Map(
    noteDocuments.map((document) => [String(document.metadata.noteId), document]),
  );

  const signals = team.editorial.signals.map((signal) => ({
    ...signal,
    sourceTitle: notesById.get(signal.noteId)?.title ?? "Saturday Signal desk note",
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
      countdown={getKickoffCountdown(nextGame)}
      leadSourceTitle={
        notesById.get(team.editorial.lead.noteId)?.title ?? "Saturday Signal desk note"
      }
      nextGame={nextGame}
      schedule={schedule}
      scheduleCapturedLabel={schedule ? formatCaptureDate(schedule.capturedAt) : undefined}
      signals={signals}
      sourceStates={sourceStates}
      starterCitations={starterCitations}
      team={team}
      teamOptions={teamOptions}
      themeStyle={createTeamThemeStyle(team)}
    />
  );
}

const paletteRoles: Array<[string, keyof TeamPalette]> = [
  ["page", "page"],
  ["surface", "surface"],
  ["surface-soft", "surfaceSoft"],
  ["surface-strong", "surfaceStrong"],
  ["ink", "ink"],
  ["ink-subtle", "inkSubtle"],
  ["muted", "muted"],
  ["border", "border"],
  ["border-strong", "borderStrong"],
  ["accent", "accent"],
  ["accent-strong", "accentStrong"],
  ["accent-soft", "accentSoft"],
  ["on-accent", "onAccent"],
  ["steel", "steel"],
  ["steel-raised", "steelRaised"],
  ["on-steel", "onSteel"],
  ["focus", "focus"],
];

function createTeamThemeStyle(team: TeamConfig): CSSProperties {
  const palettes = deriveTeamPalettes(team.theme);
  const customProperties: Record<string, string> = {};

  for (const mode of ["light", "dark"] as const) {
    for (const [cssRole, paletteRole] of paletteRoles) {
      customProperties[`--team-${mode}-${cssRole}`] = palettes[mode][paletteRole];
    }
  }

  return customProperties as CSSProperties;
}
