import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTeamConfig } from "../src/config/team";
import {
  buildTeamSchedule,
  type CfbdMediaEntry,
  type CfbdScheduleGame,
} from "../src/server/sources/cfbd-schedule";

// Rebuilds a team's schedule fixture from CollegeFootballData.
//
//   pnpm schedule:build utah-state-football America/Denver
//
// Schedules are facts with dates on them, and a fact that was retyped by hand
// is a fact that will be wrong by October. This makes the fixture a build
// output: run it again in-season and the times, venues, and TV assignments
// come back from the API rather than from memory.
const apiBase = "https://api.collegefootballdata.com";

// Where the team's own schedule lives, so the fixture keeps a link a fan can
// check rather than pointing at the API it was assembled from.
const officialScheduleUrls: Record<string, string> = {
  "texas-football": "https://texaslonghorns.com/sports/football/schedule/2026",
  "utah-state-football": "https://utahstateaggies.com/sports/football/schedule/2026",
};

async function main() {
  const teamSlug = process.argv[2];
  const timeZone = process.argv[3] ?? "America/Chicago";

  if (!teamSlug) {
    throw new Error("Usage: pnpm schedule:build <team-slug> [IANA time zone]");
  }

  const team = getTeamConfig(teamSlug);

  if (!team) {
    throw new Error(`Unknown team: ${teamSlug}`);
  }

  if (!team.cfbd) {
    throw new Error(`${teamSlug} has no cfbd block in its config, so there is nothing to query.`);
  }

  const apiKey = process.env.CFBD_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CFBD_API_KEY is not set. Register a free key at collegefootballdata.com and put it in .env.local.",
    );
  }

  const query = new URLSearchParams({
    year: String(team.cfbd.season),
    team: team.cfbd.team,
    seasonType: "regular",
  });

  const [games, media] = await Promise.all([
    fetchJson<CfbdScheduleGame[]>(`${apiBase}/games?${query}`, apiKey),
    // Broadcast assignments live on a separate endpoint and are published
    // later than the games themselves. A missing media list is normal in the
    // spring, so it must not fail the build.
    fetchJson<CfbdMediaEntry[]>(`${apiBase}/games/media?${query}`, apiKey).catch((error) => {
      console.warn(`Media lookup failed, continuing without TV: ${String(error)}`);

      return [] as CfbdMediaEntry[];
    }),
  ]);

  const schedule = buildTeamSchedule({
    team,
    games,
    media,
    timeZone,
    sourceUrl: officialScheduleUrls[teamSlug] ?? `${apiBase}/games?${query}`,
    capturedAt: new Date().toISOString(),
  });

  if (schedule.games.length === 0) {
    throw new Error(
      `CFBD returned no games for "${team.cfbd.team}" in ${team.cfbd.season}. Check the team name against CFBD's own spelling.`,
    );
  }

  const directory = path.join(process.cwd(), "data", "fixtures", teamSlug);
  const file = path.join(directory, "schedule.json");

  await mkdir(directory, { recursive: true });
  await writeFile(file, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");

  console.log(`Wrote ${schedule.games.length} games to ${path.relative(process.cwd(), file)}`);
}

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });

  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`);
  }

  return (await response.json()) as T;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
