// @vitest-environment node
import { expect, it } from "vitest";
import { inspectTeamRows } from "./database";
import { teamRegistrySchema } from "./contract";
import current from "../../../data/teams/current.json";

it("checks the specific team, season and game rows instead of treating a working connection as readiness", () => {
  const manifests = teamRegistrySchema.parse(current);
  const rows = {
    teams: Object.values(manifests).map(({ identity }) => ({ slug: identity.slug, displayName: identity.displayName })),
    seasons: Object.values(manifests).map(({ identity, schedule }) => ({ teamSlug: identity.slug, year: schedule.seasonYear })),
    games: Object.values(manifests).flatMap(({ identity, schedule }) => schedule.games.map((game) => ({ teamSlug: identity.slug, seasonYear: schedule.seasonYear, id: game.id }))),
  };
  expect(inspectTeamRows(manifests, rows)).toEqual([]);
  rows.teams[0].displayName = "Old display name"; rows.seasons.shift(); rows.games.shift();
  expect(inspectTeamRows(manifests, rows).map((finding) => finding.code)).toEqual([
    "database-team-missing-or-outdated", "database-season-missing", "database-games-missing",
  ]);
});
