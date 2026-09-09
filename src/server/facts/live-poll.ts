import { eq, sql } from "drizzle-orm";
import { pollWeekSchema } from "@/lib/facts/poll";
import { getSharedDb } from "@/server/db/client";
import { pollSnapshots } from "@/server/db/schema";
import { reportDegradation } from "@/server/observability/report";
import { fetchVerifiedPoll } from "./poll-provider";
import { createPollRefresher } from "./poll-refresh";
import { getBundledPoll } from "./poll-snapshot";

const refresh = createPollRefresher({
  fetch: fetchVerifiedPoll,
  fallback: getBundledPoll,
  load: async (season) => {
    const db = getSharedDb(); if (!db) return undefined;
    const [row] = await db.select().from(pollSnapshots).where(eq(pollSnapshots.season, season)).limit(1);
    return row ? pollWeekSchema.parse(row.snapshot) : undefined;
  },
  save: async (poll) => {
    const db = getSharedDb(); if (!db) return;
    await db.insert(pollSnapshots).values({ season: poll.season, week: poll.week, capturedAt: new Date(poll.capturedAt), snapshot: poll })
      .onConflictDoUpdate({ target: pollSnapshots.season,
        set: { week: poll.week, capturedAt: new Date(poll.capturedAt), snapshot: poll },
        setWhere: sql`${pollSnapshots.week} <= excluded.week and ${pollSnapshots.capturedAt} <= excluded.captured_at`,
      });
  },
  report: (reason) => reportDegradation(reason, { scope: "facts/poll" }),
});
export function getLatestPollWeek(season: number) {
  return process.env.SPORTS_FACTS === "fixture" ? Promise.resolve(getBundledPoll(season)) : refresh(season);
}
