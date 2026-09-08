import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Behavior tests use a frozen editorial corpus. Publication checks read the
// actual registry from disk separately; refreshing stories cannot rewrite the
// expected answers of routing, retrieval and citation regression tests.
vi.mock("@/lib/editions/current", async () => {
  const { default: fixtures } = await import("./src/test/fixtures/editions.json");
  const { parseEditionRegistry } = await import("./src/lib/editions/contract");
  const editions = parseEditionRegistry(fixtures);
  return { getPublishedEdition: (slug: string) => editions[slug] };
});

beforeEach(() => {
  // Mock Date only: network retries and UI timers must continue to run.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-08T14:00:00Z"));
});
afterEach(() => vi.useRealTimers());
