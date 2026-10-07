// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { createCommitteeRefresher } from "./committee-refresh";

function ranking(week: number, releasedAt: string, capturedAt: string): CommitteeRanking {
  return {
    season: 2026, week, weekLabel: `Week ${week}`, releasedAt, capturedAt,
    sourceUrl: "https://www.ncaa.com/rankings/football/fbs/college-football-playoff",
    ranks: Array.from({ length: 25 }, (_, index) => ({ rank: index + 1, team: `School ${index + 1}`, record: "8-1" })),
    provenance: { provider: "espn", sourceUrl: "https://site.api.espn.com/", retrievedAt: capturedAt, verifiedUrl: "https://www.ncaa.com/", throughDate: releasedAt },
  };
}
const first = ranking(10, "2026-11-03", "2026-11-04T03:00:00.000Z");
const second = ranking(11, "2026-11-10", "2026-11-11T03:00:00.000Z");

it("treats an unreleased ranking as normal and shares one refresh per interval", async () => {
  const now = new Date("2026-10-06T12:00:00Z");
  const fetch = vi.fn().mockResolvedValue(null); const report = vi.fn();
  const refresh = createCommitteeRefresher({ fetch, fallback: () => undefined, report, now: () => now });
  const [a, b] = await Promise.all([refresh(2026), refresh(2026)]);
  expect(a).toBeUndefined(); expect(b).toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1); expect(report).not.toHaveBeenCalled();
  await refresh(2026); expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps the last good ranking through failures and refuses a rollback", async () => {
  let now = new Date("2026-11-11T04:00:00Z");
  const fetch = vi.fn().mockResolvedValueOnce(second).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(first);
  const report = vi.fn();
  const refresh = createCommitteeRefresher({ fetch, fallback: () => first, report, now: () => now });
  expect(await refresh(2026)).toEqual(second);
  now = new Date("2026-11-11T05:00:00Z");
  expect(await refresh(2026)).toEqual(second); expect(report).toHaveBeenLastCalledWith("committee-refresh-rejected");
  now = new Date("2026-11-11T06:00:00Z");
  expect(await refresh(2026)).toEqual(second); expect(report).toHaveBeenCalledTimes(2);
});

it("does not serve a bundled ranking from the future or another season, and survives a failing reporter", async () => {
  const refresh = createCommitteeRefresher({
    fetch: async () => { throw new Error("offline"); }, fallback: () => first,
    report: () => { throw new Error("logger failed"); }, now: () => new Date("2026-11-01T00:00:00Z"),
  });
  expect(await refresh(2026)).toBeUndefined();
  const other = createCommitteeRefresher({ fetch: async () => null, fallback: () => first, report: vi.fn(), now: () => new Date("2027-11-20T00:00:00Z") });
  expect(await other(2027)).toBeUndefined();
});
