import { enabledTeamSlugs, getTeamConfig } from "../src/config/team";
import { publishTeamSchedule, readTeamRegistry } from "../src/lib/teams/publish";
import { fetchGameDayFeed, verifiedGameDayRank } from "../src/server/facts/game-day-ranks";
import { reportError } from "../src/server/observability/report";

async function main() {
  const now = new Date();
  const registry = await readTeamRegistry(process.cwd());
  const feeds = new Map<string, unknown>();
  // Acquire everything before publishing; malformed or unavailable evidence
  // cannot partially replace a team's known game-day ranks.
  const updates = [];
  let verified = 0, missing = 0;
  for (const slug of enabledTeamSlugs) {
    const team = getTeamConfig(slug)!;
    const schedule = structuredClone(registry[slug].schedule);
    let changed = false;
    for (const game of schedule.games) {
      if (game.status !== "final" || !game.result || !game.date || game.opponentRankAtKickoff) continue;
      if (!feeds.has(game.date)) feeds.set(game.date, await fetchGameDayFeed(game.date));
      const rank = verifiedGameDayRank(feeds.get(game.date), team, game, schedule.seasonYear, schedule.timeZone, now);
      if (!rank) { missing += 1; continue; }
      game.opponentRankAtKickoff = rank; changed = true; verified += 1;
    }
    if (changed) { schedule.capturedAt = now.toISOString(); updates.push(schedule); }
  }
  for (const schedule of updates) await publishTeamSchedule(process.cwd(), schedule, now);
  console.log(JSON.stringify({ status: missing ? "incomplete" : "verified", verified, missing, datesFetched: feeds.size }));
  if (missing) process.exitCode = 1;
}
main().catch((error) => { reportError(error, { scope: "facts/game-day-ranks" }); process.exitCode = 1; });
