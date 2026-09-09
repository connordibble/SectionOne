// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import saved from "../../../data/facts/ap-poll.json";
import { publishPollFile } from "./poll-file";

it("preserves the file after a poll rollback, accepts a new season and cleans its lock", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "poll-publication-"));
  const file = path.join(root, "poll.json");
  try {
    const now = new Date("2027-09-01T12:00:00Z");
    await publishPollFile(file, saved, now);
    const original = await readFile(file, "utf8");
    await expect(publishPollFile(file, { ...saved, week: 0, capturedAt: now.toISOString() }, now)).rejects.toThrow("regressed");
    expect(await readFile(file, "utf8")).toBe(original);
    await expect(publishPollFile(file, { ...saved, capturedAt: "2028-01-01T00:00:00Z" }, now)).rejects.toThrow("cutoff");
    const next = { ...saved, season: 2027, week: 0, capturedAt: now.toISOString(), polls: saved.polls.map((poll) => ({ ...poll, releasedAt: "2027-08-31" })) };
    await publishPollFile(file, next, now);
    expect(JSON.parse(await readFile(file, "utf8")).season).toBe(2027);
    expect(await readdir(root)).toEqual(["poll.json"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
