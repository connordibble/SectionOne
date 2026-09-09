import { createDbClient } from "@/server/db/client";
import { games, seasons, teams } from "@/server/db/schema";
import type { TeamManifest } from "./contract";

type Rows = {
  teams: Array<{ slug: string; displayName: string }>;
  seasons: Array<{ teamSlug: string; year: number }>;
  games: Array<{ teamSlug: string; seasonYear: number; id: string }>;
};
export function inspectTeamRows(manifests: Record<string, TeamManifest>, rows: Rows) {
  const findings: Array<{ teamSlug: string; code: string; severity: "error" }> = [];
  for (const [slug, { identity, schedule }] of Object.entries(manifests)) {
    if (!rows.teams.some((row) => row.slug === slug && row.displayName === identity.displayName)) findings.push({ teamSlug: slug, code: "database-team-missing-or-outdated", severity: "error" });
    if (!rows.seasons.some((row) => row.teamSlug === slug && row.year === schedule.seasonYear)) findings.push({ teamSlug: slug, code: "database-season-missing", severity: "error" });
    const ids = new Set(rows.games.filter((row) => row.teamSlug === slug && row.seasonYear === schedule.seasonYear).map((row) => row.id));
    if (schedule.games.some((game) => !ids.has(game.id))) findings.push({ teamSlug: slug, code: "database-games-missing", severity: "error" });
  }
  return findings;
}

export async function checkTeamDatabase(manifests: Record<string, TeamManifest>) {
  if (!process.env.DATABASE_URL) return [{ teamSlug: "*", code: "database-not-configured", severity: "error" as const }];
  const { db, client } = createDbClient();
  try {
    const teamRows = await db.select({ slug: teams.slug, displayName: teams.displayName }).from(teams);
    const seasonRows = await db.select({ teamSlug: seasons.teamSlug, year: seasons.year }).from(seasons);
    const gameRows = await db.select({ id: games.id, teamSlug: games.teamSlug, seasonYear: games.seasonYear }).from(games);
    return inspectTeamRows(manifests, { teams: teamRows, seasons: seasonRows, games: gameRows });
  } catch { return [{ teamSlug: "*", code: "database-check-unavailable", severity: "error" as const }]; }
  finally { await client.end(); }
}
