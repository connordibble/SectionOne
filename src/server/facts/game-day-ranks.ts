import { z } from "zod";
import type { TeamConfig } from "@/config/team";
import { calendarDate, type ScheduleGame } from "@/lib/facts/schedule";

const key = (name: string) => name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const competitorSchema = z.object({
  team: z.object({ location: z.string(), displayName: z.string(), shortDisplayName: z.string().optional() }),
  curatedRank: z.object({ current: z.number().int() }).optional(),
  score: z.string().optional(),
});
const eventSchema = z.object({
  id: z.string().regex(/^\d+$/), date: z.string(), season: z.object({ year: z.number().int() }),
  status: z.object({ type: z.object({ completed: z.boolean() }) }),
  competitions: z.array(z.object({ competitors: z.array(competitorSchema).length(2) })).min(1),
});
const feedSchema = z.object({ events: z.array(z.unknown()) });

export function gameDayFeedUrl(date: string): string {
  if (!z.iso.date().safeParse(date).success) throw new Error("Invalid game-day date");
  return `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date.replaceAll("-", "")}&groups=80&limit=200`;
}

// The archived scoreboard carries AP ranks for that game, not today's poll.
// Match both schools, season, local game date and final scores before admitting
// a rank. Missing rank is unknown; ESPN's explicit 99 sentinel is unranked.
export function verifiedGameDayRank(feed: unknown, team: TeamConfig, game: ScheduleGame, season: number, timeZone: string, now: Date): ScheduleGame["opponentRankAtKickoff"] {
  if (game.status !== "final" || !game.date || !game.result) return undefined;
  const teamNames = [team.shortName, team.displayName, ...team.aliases].map(key);
  const opponentNames = [game.opponent, ...(key(game.opponent) === "ole miss" ? ["Mississippi"] : [])].map(key);
  const matches = (names: string[], competitor: z.infer<typeof competitorSchema>) =>
    [competitor.team.location, competitor.team.displayName, competitor.team.shortDisplayName].some((name) => name && names.includes(key(name)));
  const candidates = feedSchema.parse(feed).events.flatMap((raw) => {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success) return [];
    const event = parsed.data;
    if (event.season.year !== season || !event.status.type.completed || !Number.isFinite(Date.parse(event.date))
      || calendarDate(new Date(event.date), timeZone) !== game.date) return [];
    const competitors = event.competitions[0].competitors;
    const own = competitors.find((entry) => matches(teamNames, entry));
    const opponent = competitors.find((entry) => matches(opponentNames, entry));
    return own && opponent && own !== opponent ? [{ event, own, opponent }] : [];
  });
  if (candidates.length > 1) throw new Error("Ambiguous archived game");
  if (!candidates.length) return undefined;
  const { event, own, opponent } = candidates[0];
  if (Number(own.score) !== game.result.teamScore || Number(opponent.score) !== game.result.opponentScore) throw new Error("Archived game disagrees with verified score");
  const rank = opponent.curatedRank?.current;
  if (rank === undefined) return undefined;
  if (rank !== 99 && (rank < 1 || rank > 25)) throw new Error("Invalid archived AP rank");
  if (new Date(event.date) > now) throw new Error("Cannot verify a future game");
  return { pollId: "ap", rank: rank === 99 ? null : rank, gameDate: game.date,
    sourceUrl: `https://www.espn.com/college-football/game/_/gameId/${event.id}`, checkedAt: now.toISOString() };
}

export async function fetchGameDayFeed(date: string, fetchImpl = fetch): Promise<unknown> {
  const response = await fetchImpl(gameDayFeedUrl(date), { redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Archived ranking source unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength; if (bytes > 4_000_000) throw new Error("Archived ranking source exceeds limit"); chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
