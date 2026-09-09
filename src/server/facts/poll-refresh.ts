import { comparePollSnapshots, pollWeekSchema, validatePollCutoff, type PollWeek } from "@/lib/facts/poll";

type Dependencies = {
  fetch: (season: number, now: Date) => Promise<PollWeek>;
  load: (season: number) => Promise<PollWeek | undefined>;
  save: (poll: PollWeek) => Promise<void>;
  fallback: (season: number) => PollWeek | undefined;
  report: (reason: string) => void;
  now?: () => Date;
};
const refreshMs = 15 * 60_000;
const retryMs = 2 * 60_000;
function newest(a: PollWeek | undefined, b: PollWeek | undefined): PollWeek | undefined {
  if (!a) return b;
  if (!b) return a;
  return comparePollSnapshots(a, b) > 0 ? a : b;
}

// One bounded refresh per interval and process, shared across all team pages.
// A persistent snapshot survives cold starts. Failed refreshes retain it.
export function createPollRefresher(deps: Dependencies) {
  const cache = new Map<number, { value?: PollWeek; nextCheck: number }>();
  const inflight = new Map<number, Promise<PollWeek | undefined>>();
  const report = (reason: string) => { try { deps.report(reason); } catch { /* Reporting cannot change the result. */ } };
  return async (season: number): Promise<PollWeek | undefined> => {
    const now = deps.now?.() ?? new Date();
    const previous = cache.get(season);
    if (previous && previous.nextCheck > now.getTime()) return previous.value;
    const pending = inflight.get(season);
    if (pending) return pending;
    const task = (async () => {
      let value = previous?.value;
      if (!value) {
        try {
          const fallback = deps.fallback(season);
          if (fallback) {
            const parsed = pollWeekSchema.parse(fallback);
            validatePollCutoff(parsed, now);
            if (parsed.season === season) value = parsed;
          }
        } catch { report("poll-fallback-rejected"); }
      }
      let storedSnapshot = false;
      if (!previous) {
        try {
          const stored = await deps.load(season);
          if (stored) {
            const parsed = pollWeekSchema.parse(stored);
            validatePollCutoff(parsed, now);
            if (parsed.season === season) {
              value = newest(value, parsed);
              storedSnapshot = value === parsed;
            }
          }
        } catch { report("poll-store-read"); }
      }
      if (value && Date.parse(value.capturedAt) <= now.getTime() && now.getTime() - Date.parse(value.capturedAt) < refreshMs) {
        if (!previous && !storedSnapshot) {
          try { await deps.save(value); } catch { report("poll-store-write"); }
        }
        cache.set(season, { value, nextCheck: Date.parse(value.capturedAt) + refreshMs });
        return value;
      }
      try {
        const candidate = pollWeekSchema.parse(await deps.fetch(season, now));
        validatePollCutoff(candidate, now);
        if (candidate.season !== season) throw new Error("Invalid poll season");
        const selected = newest(value, candidate);
        if (selected !== candidate) throw new Error("Poll regressed");
        value = candidate;
        try { await deps.save(value); } catch { report("poll-store-write"); }
        cache.set(season, { value, nextCheck: now.getTime() + refreshMs });
      } catch {
        report("poll-refresh-rejected");
        cache.set(season, { value, nextCheck: now.getTime() + retryMs });
      }
      return value;
    })();
    inflight.set(season, task);
    try { return await task; } finally { inflight.delete(season); }
  };
}
