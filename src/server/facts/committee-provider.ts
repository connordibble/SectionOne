import { z } from "zod";
import { committeeRankingSchema, type CommitteeRanking } from "@/lib/postseason/committee";
import { teamNameKey } from "@/lib/facts/team-names";
import { plain, rankingFeedUrl, readBoundedText } from "./poll-provider";

export const committeeVerificationUrl = "https://www.ncaa.com/rankings/football/fbs/college-football-playoff";

// The feed lists the committee's ranking alongside the media polls, as
// `type: "cfp"`, only once one has been released. Its name has varied, so the
// type is the key.
const espnCommittee = z.object({
  type: z.literal("cfp"), date: z.string(),
  season: z.object({ year: z.number().int() }), occurrence: z.object({ number: z.number().int(), displayValue: z.string() }),
  ranks: z.array(z.object({
    current: z.number().int(), recordSummary: z.string().optional(), team: z.object({ location: z.string().min(1) }),
  })),
});
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// Returns null when the committee has not released a ranking for this season,
// which is a normal state for most of the year and not a failure. Anything
// that is published but cannot be verified throws, so the caller keeps the
// last good ranking. No model ever supplies a rank, record or team name.
function publishedEntry(feed: unknown, season: number) {
  const rankings = z.object({ rankings: z.array(z.unknown()) }).parse(feed).rankings;
  const candidates = rankings.filter((item) => typeof item === "object" && item !== null && "type" in item && item.type === "cfp");
  if (!candidates.length) return null;
  if (candidates.length > 1) throw new Error("Expected one committee ranking");
  const ranking = espnCommittee.parse(candidates[0]);
  return ranking.season.year === season ? ranking : null;
}

export function parseVerifiedCommitteeRanking(feed: unknown, ncaaHtml: string | undefined, season: number, now: Date): CommitteeRanking | null {
  const ranking = publishedEntry(feed, season);
  if (!ranking) return null;
  const releasedAt = z.iso.date().parse(ranking.date.slice(0, 10));
  if (Date.parse(releasedAt) > now.getTime()) throw new Error("Future committee ranking");
  if (!ncaaHtml) throw new Error("Missing committee verification");
  const cutoff = ncaaHtml.match(/Through Games\s+([A-Z]+)\.?\s+(\d{1,2}),\s+(\d{4})/i);
  const month = cutoff ? months.indexOf(cutoff[1].slice(0, 3).toUpperCase()) + 1 : 0;
  if (!cutoff || !month) throw new Error("Missing committee verification cutoff");
  const throughDate = z.iso.date().parse(`${cutoff[3]}-${String(month).padStart(2, "0")}-${cutoff[2].padStart(2, "0")}`);
  // Rankings air on Tuesday covering games through the prior weekend; the
  // Selection Day ranking covers the day before. Anything else is a page for
  // a different release.
  const age = Date.parse(releasedAt) - Date.parse(throughDate);
  if (age < 0 || age > 4 * 86_400_000) throw new Error("Committee ranking and verification dates disagree");
  const tables = [...ncaaHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((candidate) => /<th[^>]*>\s*RANK\s*<\/th>/i.test(candidate) && /<th[^>]*>\s*SCHOOL\s*<\/th>/i.test(candidate) && /<th[^>]*>\s*RECORD\s*<\/th>/i.test(candidate));
  if (!table) throw new Error("Missing committee verification table");
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plain(cell[1])))
    .filter((row) => row.length);
  if (rows.length !== ranking.ranks.length) throw new Error("Partial or mismatched committee table");
  const ranks = ranking.ranks.map((entry, index) => {
    const [rank, school, record] = rows[index];
    if (Number(rank) !== entry.current || teamNameKey(school) !== teamNameKey(entry.team.location)) throw new Error("Committee sources disagree");
    if (entry.recordSummary && entry.recordSummary !== record) throw new Error("Committee records disagree");
    return { rank: entry.current, team: entry.team.location, record };
  });
  return committeeRankingSchema.parse({
    season, week: ranking.occurrence.number, weekLabel: ranking.occurrence.displayValue, releasedAt,
    capturedAt: now.toISOString(), sourceUrl: committeeVerificationUrl, ranks,
    provenance: { provider: "espn", sourceUrl: rankingFeedUrl, retrievedAt: now.toISOString(), verifiedUrl: committeeVerificationUrl, throughDate },
  });
}

export async function fetchVerifiedCommitteeRanking(season: number, now = new Date(), fetchImpl: typeof fetch = fetch): Promise<CommitteeRanking | null> {
  const feed: unknown = JSON.parse(await readBoundedText(rankingFeedUrl, 2_000_000, fetchImpl));
  // Only read the verification page when there is something to verify.
  if (!publishedEntry(feed, season)) return null;
  const verification = await readBoundedText(committeeVerificationUrl, 1_000_000, fetchImpl);
  return parseVerifiedCommitteeRanking(feed, verification, season, now);
}
