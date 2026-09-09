// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createPollRefresher } from "./poll-refresh";
import { pollWeekSchema } from "@/lib/facts/poll";
import saved from "../../../data/facts/ap-poll.json";

const baseline = pollWeekSchema.parse({ ...saved, capturedAt: "2026-09-08T12:00:00Z" });
it("shares refresh work, saves accepted changes and retains last-good data on failure", async () => {
  let now = new Date("2026-09-08T13:00:00Z");
  const candidate = { ...baseline, capturedAt: now.toISOString() };
  const fetch = vi.fn().mockResolvedValueOnce(candidate).mockRejectedValue(new Error("offline"));
  const save = vi.fn(); const load = vi.fn().mockResolvedValue(baseline);
  const refresh = createPollRefresher({ fetch, save, load, fallback: () => baseline, report: vi.fn(), now: () => now });
  const [a, b] = await Promise.all([refresh(2026), refresh(2026)]);
  expect(a).toEqual(candidate); expect(b).toEqual(candidate); expect(fetch).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  await refresh(2026); expect(fetch).toHaveBeenCalledTimes(1);
  now = new Date("2026-09-08T14:00:00Z");
  expect(await refresh(2026)).toEqual(candidate); expect(fetch).toHaveBeenCalledTimes(2); expect(save).toHaveBeenCalledTimes(1);
  await refresh(2026); expect(fetch).toHaveBeenCalledTimes(2);
});
it("uses a recent persistent snapshot on cold start and refuses a rollback", async () => {
  let now = new Date("2026-09-08T12:05:00Z");
  const fetch = vi.fn().mockResolvedValue({ ...baseline, week: 1, capturedAt: "2026-09-08T13:00:00Z" });
  const save = vi.fn();
  const refresh = createPollRefresher({ fetch, save, load: async () => baseline, fallback: () => undefined, report: () => { throw new Error('logger failed'); }, now: () => now });
  expect(await refresh(2026)).toEqual(baseline); expect(fetch).not.toHaveBeenCalled();
  now = new Date("2026-09-08T13:00:00Z");
  expect(await refresh(2026)).toEqual(baseline); expect(save).not.toHaveBeenCalled();
});

it("does not serve a future bundled fallback when refresh fails", async () => {
  const refresh = createPollRefresher({
    fetch: async () => { throw new Error("offline"); }, load: async () => undefined,
    save: vi.fn(), fallback: () => baseline, report: vi.fn(), now: () => new Date("2026-09-01"),
  });
  expect(await refresh(2026)).toBeUndefined();
});
