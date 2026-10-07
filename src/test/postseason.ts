import seasonFile from "../../data/facts/postseason/2026.json";
import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import type { OutlookInput } from "@/lib/postseason/outlook";
import { postseasonSeasonSchema } from "@/lib/postseason/season";

// Shared builders for postseason component tests. Records are explicit: the
// global test setup freezes schedules before any games were played.
export const testSeason = postseasonSeasonSchema.parse(seasonFile);

export function testSchedule(wins: number, losses: number, total = 12, opponents: string[] = []): TeamSchedule {
  const outcomes = [...Array(wins).fill("W"), ...Array(losses).fill("L"), ...Array(total - wins - losses).fill(null)];
  return {
    teamSlug: "example-football", teamName: "Example", teamDisplayName: "Example football", seasonYear: 2026,
    sourceUrl: "https://example.edu/schedule", capturedAt: "2026-10-06T12:00:00.000Z", timeZone: "America/Chicago",
    games: outcomes.map((outcome, index): ScheduleGame => ({
      id: `g${index}`, opponent: opponents[index] ?? `Opponent ${index}`, site: "home", dateLabel: "Saturday", startsAt: null, date: null,
      status: outcome ? "final" : "scheduled", kickoff: "TBD", venue: "Stadium", tv: null, opponentClassification: "fbs",
      ...(outcome ? { result: outcome === "W" ? { teamScore: 21, opponentScore: 7 } : { teamScore: 7, opponentScore: 21 } } : {}),
    })),
  };
}

export function testInput(overrides: Partial<OutlookInput> = {}): OutlookInput {
  return {
    team: { slug: "example-football", shortName: "Example", displayName: "Example football", aliases: [], conference: "Pac-12" },
    schedule: testSchedule(4, 1), season: testSeason, apRank: null, today: "2026-10-06", ...overrides,
  };
}

export function testCommittee(teams: string[]): CommitteeRanking {
  const names = [...teams, ...Array.from({ length: 25 }, (_, index) => `School ${index + 1}`)].slice(0, 25);
  return {
    season: 2026, week: 10, weekLabel: "Week 10", releasedAt: "2026-11-03", capturedAt: "2026-11-04T03:00:00.000Z",
    sourceUrl: "https://www.ncaa.com/rankings/football/fbs/college-football-playoff",
    ranks: names.map((team, index) => ({ rank: index + 1, team, record: "8-1" })),
    provenance: { provider: "espn", sourceUrl: "https://site.api.espn.com/", retrievedAt: "2026-11-04T03:00:00.000Z", verifiedUrl: "https://www.ncaa.com/", throughDate: "2026-11-01" },
  };
}

export function seasonWithField(teams: string[]) {
  return postseasonSeasonSchema.parse({ ...seasonFile, confirmed: { ...seasonFile.confirmed, playoffField: {
    announcedAt: "2026-12-06T18:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/",
    seeds: Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, team: teams[index] ?? `Seed ${index + 1}`, bid: "at-large" })),
  } } });
}
