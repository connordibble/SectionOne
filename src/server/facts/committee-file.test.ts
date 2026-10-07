// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { publishCommitteeFile } from "./committee-file";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
function ranking(week: number, releasedAt: string): CommitteeRanking {
  return {
    season: 2026, week, weekLabel: `Week ${week}`, releasedAt, capturedAt: `${releasedAt}T23:00:00.000Z`,
    sourceUrl: "https://www.ncaa.com/rankings/football/fbs/college-football-playoff",
    ranks: Array.from({ length: 25 }, (_, index) => ({ rank: index + 1, team: `School ${index + 1}`, record: "8-1" })),
    provenance: { provider: "espn", sourceUrl: "https://site.api.espn.com/", retrievedAt: `${releasedAt}T23:00:00.000Z`, verifiedUrl: "https://www.ncaa.com/", throughDate: releasedAt },
  };
}

it("publishes a newer ranking, keeps it when nothing new is released, and refuses a rollback", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "committee-")); roots.push(root);
  const file = path.join(root, "cfp.json");
  expect((await publishCommitteeFile(file, 2026, null)).ranking).toBeNull();
  await publishCommitteeFile(file, 2026, ranking(11, "2026-11-10"));
  expect((await publishCommitteeFile(file, 2026, null)).ranking?.week).toBe(11);
  await expect(publishCommitteeFile(file, 2026, ranking(10, "2026-11-03"))).rejects.toThrow("regressed");
  await expect(publishCommitteeFile(file, 2025, null)).rejects.toThrow("earlier season");
  expect(JSON.parse(await readFile(file, "utf8")).ranking.week).toBe(11);
  // A new season starts empty rather than carrying last season's ranking.
  expect((await publishCommitteeFile(file, 2027, null))).toEqual({ season: 2027, ranking: null });
});
