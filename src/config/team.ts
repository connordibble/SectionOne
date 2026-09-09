import { teamConfigSchema, type TeamConfig } from "@/lib/teams/contract";
import { teamManifests } from "@/lib/teams/current";
export type { TeamConfig } from "@/lib/teams/contract";
import { getPublishedEdition } from "@/lib/editions/current";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { getTeamNoteDocuments } from "@/server/sources/notes";

export type SourceReadinessState = "Ready" | "Planned";
export type SourceState = {
  id: "schedule" | "notes" | "official" | "statistics";
  label: string;
  description: string;
  state: SourceReadinessState;
};

function editionPresentation(slug: string, shortName: string) {
  const edition = getPublishedEdition(slug);
  if (!edition) throw new Error(`Missing published edition for ${slug}`);
  return {
    referenceLabel: `${shortName} · Week ${edition.issue.week} · ${edition.issue.season}`,
    editorial: edition.editorial,
    nextGameNote: edition.nextGameNote,
  };
}

export const teamConfigs = Object.fromEntries(
  Object.entries(teamManifests).map(([slug, { identity }]) => [slug, teamConfigSchema.parse({
    ...identity, ...editionPresentation(slug, identity.shortName),
  })]),
) as Record<keyof typeof teamManifests, TeamConfig>;

export { createThemeStyle, deriveTeamPalette, deriveTeamPalettes, houseTheme } from "@/lib/teams/theme";
export type { TeamPalette, TeamPaletteSet } from "@/lib/teams/theme";

export type TeamSlug = keyof typeof teamConfigs;

export const defaultTeamSlug: TeamSlug = "texas-football";
export const defaultTeamConfig = teamConfigs[defaultTeamSlug];
export const enabledTeamSlugs = Object.keys(teamConfigs) as TeamSlug[];

export function getTeamConfig(slug: string): TeamConfig | undefined {
  return teamConfigs[slug as TeamSlug];
}

export function validateTeamConfig(config: TeamConfig): TeamConfig {
  return teamConfigSchema.parse(config);
}

// Reflects the real ingest surface rather than a hand-maintained list: the
// schedule and official links are produced on every ingest, while statistics depend
// on both team config and a supplied API key.
export function getSourceReadiness(team: TeamConfig): SourceState[] {
  const states: SourceState[] = [
    {
      id: "schedule",
      label: "Schedule",
      description: "Dates, kickoff windows, venues, and broadcast assignments.",
      state: getTeamSchedule(team.slug) ? "Ready" : "Planned",
    },
    {
      id: "notes",
      label: "Matchup notes",
      description: "Independent reads on the team and opponent.",
      state: getTeamNoteDocuments(team.slug).length > 0 ? "Ready" : "Planned",
    },
    {
      id: "official",
      label: "Official links",
      description: "Team pages for schedules and game details.",
      state: "Ready",
    },
  ];

  if (team.cfbd) {
    states.push({
      id: "statistics",
      label: "Season statistics",
      description: "Team and opponent numbers for deeper comparisons.",
      state: process.env.CFBD_API_KEY ? "Ready" : "Planned",
    });
  } else {
    states.push({
      id: "statistics",
      label: "Season statistics",
      description: "Team and opponent numbers for deeper comparisons.",
      state: "Planned",
    });
  }

  return states;
}
