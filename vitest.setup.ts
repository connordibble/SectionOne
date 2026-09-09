import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Behavior tests use a frozen editorial corpus. Publication checks read the
// actual registry from disk separately; refreshing stories cannot rewrite the
// expected answers of routing, retrieval and citation regression tests.
vi.mock("@/lib/editions/current", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/editions/current")>();
  const { default: fixtures } = await import("./src/test/fixtures/editions.json");
  const { parseEditionRegistry } = await import("./src/lib/editions/contract");
  const editions = parseEditionRegistry(fixtures);
  // Keep established behavior cases frozen. Additional teams still participate
  // in generic contract tests without needing a source-code edit to this mock.
  return { getPublishedEdition: (slug: string) => editions[slug] ?? original.getPublishedEdition(slug) };
});

vi.mock("@/server/facts/poll-snapshot", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/facts/poll-snapshot")>();
  const { default: fixture } = await import("./data/fixtures/polls/2026-preseason.json");
  return { ...original, getBundledPoll: (season: number) => season === fixture.season ? fixture : undefined,
    getPollSnapshot: (season: number) => season === fixture.season ? fixture : undefined };
});
process.env.SPORTS_FACTS = "fixture";

beforeEach(() => {
  // Mock Date only: network retries and UI timers must continue to run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-08T14:00:00Z"));
});
afterEach(() => vi.useRealTimers());
