import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { parseEditionRegistry } from "@/lib/editions/contract";
import { teamScheduleSchema } from "@/lib/facts/schedule";
import { onboardingPackageSchema, teamRegistrySchema } from "./contract";

async function readRegistry(file: string): Promise<unknown> {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export async function readTeamRegistry(root: string) {
  return teamRegistrySchema.parse(await readRegistry(path.join(root, "data/teams/current.json")));
}

// Edition data is staged before team activation. A crash between renames leaves
// an unused edition, which an identical retry resumes without overwriting it.
// The publication lock prevents weekly updates from racing onboarding.
export async function onboardTeam(root: string, input: unknown, now = new Date()) {
  const candidate = onboardingPackageSchema.parse(input);
  if (Date.parse(candidate.edition.publishedAt) > now.getTime() || Date.parse(candidate.manifest.schedule.capturedAt) > now.getTime()) throw new Error("Cannot onboard future content");
  const slug = candidate.manifest.identity.slug;
  const editionDir = path.join(root, "data/editions"), teamDir = path.join(root, "data/teams");
  await mkdir(editionDir, { recursive: true }); await mkdir(teamDir, { recursive: true });
  const editionLock = await open(path.join(editionDir, ".publish.lock"), "wx");
  let teamLock;
  const editionTemp = path.join(editionDir, `.onboard-${randomUUID()}.tmp`);
  const teamTemp = path.join(teamDir, `.onboard-${randomUUID()}.tmp`);
  try {
    teamLock = await open(path.join(teamDir, ".publish.lock"), "wx");
    const editions = parseEditionRegistry(await readRegistry(path.join(editionDir, "current.json")));
    const teams = await readTeamRegistry(root);
    if (editions[slug] && !isDeepStrictEqual(editions[slug], candidate.edition)) throw new Error("Existing edition differs; use revision-checked publication");
    if (teams[slug] && !isDeepStrictEqual(teams[slug], candidate.manifest)) throw new Error("Existing team differs; onboarding cannot overwrite it");
    if (teams[slug] && editions[slug]) return { status: "unchanged", teamSlug: slug };
    editions[slug] = candidate.edition; teams[slug] = candidate.manifest;
    await writeFile(editionTemp, `${JSON.stringify(editions, null, 2)}\n`, { flag: "wx" });
    await writeFile(teamTemp, `${JSON.stringify(teams, null, 2)}\n`, { flag: "wx" });
    await rename(editionTemp, path.join(editionDir, "current.json"));
    await rename(teamTemp, path.join(teamDir, "current.json"));
    return { status: "onboarded", teamSlug: slug };
  } finally {
    await rm(editionTemp, { force: true }); await rm(teamTemp, { force: true });
    if (teamLock) { await teamLock.close(); await rm(path.join(teamDir, ".publish.lock"), { force: true }); }
    await editionLock.close(); await rm(path.join(editionDir, ".publish.lock"), { force: true });
  }
}

export async function publishTeamSchedule(root: string, input: unknown, now = new Date()) {
  const schedule = teamScheduleSchema.parse(input);
  if (Date.parse(schedule.capturedAt) > now.getTime()) throw new Error("Cannot publish a future schedule");
  const directory = path.join(root, "data/teams");
  const lock = await open(path.join(directory, ".publish.lock"), "wx");
  const temporary = path.join(directory, `.schedule-${randomUUID()}.tmp`);
  try {
    const registry = await readTeamRegistry(root);
    const current = registry[schedule.teamSlug];
    if (!current) throw new Error("Onboard the team before refreshing its schedule");
    const previous = current.schedule;
    if (previous.seasonYear > schedule.seasonYear || Date.parse(previous.capturedAt) > Date.parse(schedule.capturedAt)) throw new Error("Schedule refresh regressed");
    if (previous.seasonYear === schedule.seasonYear && previous.games.length > schedule.games.length) throw new Error("Schedule provider omitted existing games; retained the current schedule");
    current.schedule = schedule;
    teamRegistrySchema.parse(registry);
    await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, { flag: "wx" });
    await rename(temporary, path.join(directory, "current.json"));
    return schedule;
  } finally { await rm(temporary, { force: true }); await lock.close(); await rm(path.join(directory, ".publish.lock"), { force: true }); }
}
