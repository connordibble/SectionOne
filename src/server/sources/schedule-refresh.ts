import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TeamConfig } from "@/config/team";
import { buildTeamSchedule, cfbdGamesSchema, cfbdMediaSchema } from "./cfbd-schedule";

type RefreshInput = {
  team: TeamConfig; apiKey: string; file: string; timeZone?: string;
  fetchImpl?: typeof fetch; now?: Date;
};

// Publish only a complete acquisition. An unavailable media endpoint is not
// evidence that a previously announced broadcast has been withdrawn.
export async function refreshTeamSchedule({ team, apiKey, file, timeZone = team.timeZone, fetchImpl = fetch, now = new Date() }: RefreshInput) {
  if (!team.cfbd) throw new Error("Team has no schedule provider mapping");
  const query = new URLSearchParams({ year: String(team.cfbd.season), team: team.cfbd.team, seasonType: "regular" });
  async function read(endpoint: string) {
    const response = await fetchImpl(`https://api.collegefootballdata.com/${endpoint}?${query}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Schedule provider ${endpoint} returned HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Schedule provider returned no body");
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 2_000_000) throw new Error("Schedule provider response exceeds size limit");
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  const [rawGames, rawMedia] = await Promise.all([read("games"), read("games/media")]);
  const games = cfbdGamesSchema.parse(rawGames);
  const media = cfbdMediaSchema.parse(rawMedia);
  if (games.some((game) => game.season !== team.cfbd!.season)) throw new Error("Schedule provider returned the wrong season");
  if (new Set(games.map((game) => game.id)).size !== games.length) throw new Error("Schedule provider returned duplicate games");
  const schedule = buildTeamSchedule({ team, games, media, timeZone, sourceUrl: team.officialScheduleUrl, capturedAt: now.toISOString() });
  if (!schedule.games.length) throw new Error("Schedule provider returned no team games");
  await mkdir(path.dirname(file), { recursive: true });
  const lockPath = `${file}.lock`; const lock = await open(lockPath, "wx");
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    let previous;
    try { previous = JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    if (previous) {
      if (previous.teamSlug !== team.slug || !Array.isArray(previous.games) || !Number.isInteger(previous.seasonYear)) throw new Error("Invalid saved schedule");
      if (previous.seasonYear > schedule.seasonYear || Date.parse(previous.capturedAt) > now.getTime()) throw new Error("Schedule refresh regressed");
      if (previous.seasonYear === schedule.seasonYear && previous.games.length > schedule.games.length) throw new Error("Schedule provider omitted existing games; retained the current schedule");
    }
    await writeFile(temporary, `${JSON.stringify(schedule, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, file);
    return schedule;
  } finally {
    await rm(temporary, { force: true }); await lock.close(); await rm(lockPath, { force: true });
  }
}
