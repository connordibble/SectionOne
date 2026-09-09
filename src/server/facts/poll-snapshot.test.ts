// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.unmock("@/server/facts/poll-snapshot");
import { getPollSnapshot, getBundledPoll, withPollSnapshot } from "./poll-snapshot";
import { corpusVersion } from "@/server/chat/cache";

it("keeps an explicitly unavailable poll unavailable inside a request", () => {
  expect(getBundledPoll(2026)).toBeDefined();
  expect(withPollSnapshot(undefined, () => getPollSnapshot(2026))).toBeUndefined();
});

it("isolates concurrent request snapshots and invalidates cached answers when ranks change", async () => {
  const original = structuredClone(getBundledPoll(2026)!);
  const changed = structuredClone(original);
  changed.polls[0].ranks[3].team = "Different school";
  const results = await Promise.all([original, changed].map((poll) => withPollSnapshot(poll, async () => {
    await Promise.resolve();
    return { poll: getPollSnapshot(2026), key: corpusVersion("texas-football") };
  })));
  expect(results[0].poll).toEqual(original);
  expect(results[1].poll).toEqual(changed);
  expect(results[0].key).not.toBe(results[1].key);
  const rechecked = { ...original, capturedAt: "2026-09-08T23:00:00Z" };
  expect(withPollSnapshot(rechecked, () => corpusVersion("texas-football"))).toBe(results[0].key);
});
