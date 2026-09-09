import { z } from "zod";
import { pollWeekSchema, type PollWeek } from "@/lib/facts/poll";

export const rankingFeedUrl = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings";
export const rankingVerificationUrl = "https://www.ncaa.com/rankings/football/fbs/associated-press";
const espnPoll = z.object({
  type: z.literal("ap"), name: z.literal("AP Top 25"), date: z.string(),
  season: z.object({ year: z.number().int() }), occurrence: z.object({ number: z.number().int(), displayValue: z.string() }),
  ranks: z.array(z.object({ current: z.number().int(), points: z.number().int(), team: z.object({ location: z.string().min(1) }) })),
});
const aliases: Record<string, string> = { "miami fl": "miami", "southern cal": "usc", "southern california": "usc", "ole miss": "mississippi", "brigham young": "byu" };
const normalize = (name: string) => {
  const key = name.toLowerCase().replace(/\(\d+\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  return aliases[key] ?? key;
};
const plain = (html: string) => html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#0*39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();

// Provider parsing never asks a model to supply a rank, date or team name.
// Two published representations must agree before a new snapshot is admitted.
export function parseVerifiedPoll(feed: unknown, ncaaHtml: string, season: number, now: Date): PollWeek {
  const rankings = z.object({ rankings: z.array(z.unknown()) }).parse(feed).rankings;
  const candidates = rankings.filter((item) => typeof item === "object" && item !== null && "type" in item && item.type === "ap");
  if (candidates.length !== 1) throw new Error("Expected one AP poll");
  const poll = espnPoll.parse(candidates[0]);
  const releasedAt = z.iso.date().parse(poll.date.slice(0, 10));
  if (poll.season.year !== season || Date.parse(releasedAt) > now.getTime()) throw new Error("Wrong season or future poll");
  const dateMatch = ncaaHtml.match(/Through Games\s+([A-Z]+)\.?\s+(\d{1,2}),\s+(\d{4})/i);
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const month = dateMatch ? months.indexOf(dateMatch[1].slice(0, 3).toUpperCase()) + 1 : 0;
  if (!dateMatch || !month) throw new Error("Missing verification cutoff");
  const throughDate = z.iso.date().parse(`${dateMatch[3]}-${String(month).padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`);
  const age = Date.parse(releasedAt) - Date.parse(throughDate);
  if (age < 0 || age > 3 * 86400000) throw new Error("Poll and verification dates disagree");
  const tables = [...ncaaHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  const table = tables.find((table) => /<th[^>]*>\s*RANK\s*<\/th>/i.test(table) && /<th[^>]*>\s*SCHOOL\s*<\/th>/i.test(table));
  if (!table) throw new Error("Missing verification table");
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plain(cell[1]))).filter((row) => row.length);
  if (rows.length !== poll.ranks.length) throw new Error("Partial or mismatched verification table");
  for (const [index, entry] of poll.ranks.entries()) {
    const row = rows[index];
    if (Number(row[0].replace(/^T/i, "")) !== entry.current || normalize(row[1]) !== normalize(entry.team.location) || Number(row[2].replaceAll(",", "")) !== entry.points) throw new Error("Ranking sources disagree");
  }
  return pollWeekSchema.parse({
    season, week: poll.occurrence.number, weekLabel: poll.occurrence.displayValue,
    capturedAt: now.toISOString(), pending: [],
    provenance: { provider: "espn", sourceUrl: rankingFeedUrl, retrievedAt: now.toISOString(), verifiedUrl: rankingVerificationUrl, throughDate },
    polls: [{ id: "ap", name: "AP Top 25", releasedAt, sourceUrl: rankingVerificationUrl, ranks: poll.ranks.map((entry) => ({ rank: entry.current, team: entry.team.location })) }],
  });
}

export async function fetchVerifiedPoll(season: number, now = new Date(), fetchImpl = fetch): Promise<PollWeek> {
  const read = async (url: string, maximum: number) => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000), redirect: "error", cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("Poll source unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength; if (bytes > maximum) throw new Error("Poll source too large"); chunks.push(value);
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString("utf8");
  };
  const [feed, verification] = await Promise.all([read(rankingFeedUrl, 2_000_000), read(rankingVerificationUrl, 1_000_000)]);
  return parseVerifiedPoll(JSON.parse(feed), verification, season, now);
}
