import { committeeRankingSchema, compareCommitteeRankings, type CommitteeRanking } from "@/lib/postseason/committee";

type Dependencies = {
  // Resolves null when the committee has not released a ranking yet.
  fetch: (season: number, now: Date) => Promise<CommitteeRanking | null>;
  fallback: (season: number) => CommitteeRanking | undefined;
  report: (reason: string) => void;
  now?: () => Date;
};
const refreshMs = 15 * 60_000;
const retryMs = 2 * 60_000;

function admissible(value: unknown, season: number, now: Date): CommitteeRanking {
  const ranking = committeeRankingSchema.parse(value);
  if (ranking.season !== season || Date.parse(ranking.capturedAt) > now.getTime()) throw new Error("Inadmissible committee ranking");
  return ranking;
}

// One bounded refresh per interval and process, shared by every page. The
// bundled snapshot covers a cold start; a failed or regressing refresh keeps
// the last good ranking, and "not released yet" is not a failure.
export function createCommitteeRefresher(deps: Dependencies) {
  const cache = new Map<number, { value?: CommitteeRanking; nextCheck: number }>();
  const inflight = new Map<number, Promise<CommitteeRanking | undefined>>();
  const report = (reason: string) => { try { deps.report(reason); } catch { /* Reporting cannot change the result. */ } };
  return async (season: number): Promise<CommitteeRanking | undefined> => {
    const now = deps.now?.() ?? new Date();
    const previous = cache.get(season);
    if (previous && previous.nextCheck > now.getTime()) return previous.value;
    const pending = inflight.get(season);
    if (pending) return pending;
    const task = (async () => {
      let value = previous?.value;
      if (!previous) {
        try {
          const bundled = deps.fallback(season);
          if (bundled) value = admissible(bundled, season, now);
        } catch { report("committee-fallback-rejected"); }
      }
      try {
        const fetched = await deps.fetch(season, now);
        if (fetched) {
          const candidate = admissible(fetched, season, now);
          if (value && compareCommitteeRankings(candidate, value) < 0) throw new Error("Committee ranking regressed");
          value = candidate;
        }
        cache.set(season, { value, nextCheck: now.getTime() + refreshMs });
      } catch {
        report("committee-refresh-rejected");
        cache.set(season, { value, nextCheck: now.getTime() + retryMs });
      }
      return value;
    })();
    inflight.set(season, task);
    try { return await task; } finally { inflight.delete(season); }
  };
}
