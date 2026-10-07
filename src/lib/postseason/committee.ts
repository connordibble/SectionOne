import { z } from "zod";

const https = z.url().refine((url) => url.startsWith("https://"));

// The selection committee's top 25. Unlike a media poll it has no ties and no
// points, and each row carries the record the committee ranked.
export const committeeRankingSchema = z.object({
  season: z.number().int().min(2000).max(2200),
  week: z.number().int().min(0).max(30),
  weekLabel: z.string().min(1),
  releasedAt: z.iso.date(),
  capturedAt: z.iso.datetime({ offset: true }),
  sourceUrl: https,
  ranks: z.array(z.object({
    rank: z.number().int().min(1).max(25),
    team: z.string().trim().min(1),
    record: z.string().regex(/^\d{1,2}-\d{1,2}$/),
  })).length(25),
  provenance: z.object({
    provider: z.literal("espn"), sourceUrl: z.url(), retrievedAt: z.iso.datetime({ offset: true }),
    verifiedUrl: z.url(), throughDate: z.iso.date(),
  }),
}).superRefine((ranking, ctx) => {
  if (ranking.ranks.some((row, index) => row.rank !== index + 1)) {
    ctx.addIssue({ code: "custom", path: ["ranks"], message: "Committee ranks run 1 through 25 without ties" });
  }
  const names = ranking.ranks.map((row) => row.team.toLowerCase());
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", path: ["ranks"], message: "Duplicate ranked team" });
  if (Date.parse(ranking.releasedAt) > Date.parse(ranking.capturedAt)) {
    ctx.addIssue({ code: "custom", path: ["releasedAt"], message: "Released after it was captured" });
  }
});

// `ranking: null` is a real state: the committee has not released one yet.
export const committeeSnapshotSchema = z.object({
  season: z.number().int().min(2000).max(2200),
  ranking: committeeRankingSchema.nullable(),
}).superRefine((snapshot, ctx) => {
  if (snapshot.ranking && snapshot.ranking.season !== snapshot.season) {
    ctx.addIssue({ code: "custom", path: ["ranking", "season"], message: "Ranking belongs to another season" });
  }
});

export type CommitteeRanking = z.infer<typeof committeeRankingSchema>;
export type CommitteeSnapshot = z.infer<typeof committeeSnapshotSchema>;

// A later release always wins; retrieval time alone never makes an older
// ranking current, the same ordering the AP snapshot uses.
export function compareCommitteeRankings(a: CommitteeRanking, b: CommitteeRanking): number {
  if (a.season !== b.season) return a.season - b.season;
  if (a.week !== b.week) return a.week - b.week;
  const release = Date.parse(a.releasedAt) - Date.parse(b.releasedAt);
  return release || Date.parse(a.capturedAt) - Date.parse(b.capturedAt);
}
