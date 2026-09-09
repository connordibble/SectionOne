import path from "node:path";
import { getTeamConfig } from "../src/config/team";
import { refreshTeamSchedule } from "../src/server/sources/schedule-refresh";
import { reportError } from "../src/server/observability/report";

async function main() {
  const teamSlug = process.argv[2];
  if (!teamSlug) throw new Error("Usage: pnpm schedule:build <team-slug> [IANA time zone]");
  const team = getTeamConfig(teamSlug);
  if (!team) throw new Error("Unknown team");
  const apiKey = process.env.CFBD_API_KEY;
  if (!apiKey) throw new Error("CFBD_API_KEY is not configured");
  const file = path.join(process.cwd(), "data", "fixtures", team.slug, "schedule.json");
  const schedule = await refreshTeamSchedule({ team, apiKey, file, timeZone: process.argv[3] ?? team.timeZone });
  console.log(JSON.stringify({ status: "refreshed", teamSlug, games: schedule.games.length }));
}
main().catch((error) => {
  reportError(error, { scope: "facts/schedule-build" });
  process.exitCode = 1;
});
