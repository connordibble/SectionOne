import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import seasonFile from "../../../data/facts/postseason/2026.json";
import { teamConfigs } from "@/config/team";
import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { teamPostseason } from "@/lib/postseason/outlook";
import { postseasonSeasonSchema, type PostseasonSeason } from "@/lib/postseason/season";
import type { PlayoffTracker } from "@/server/postseason/postseason";
import { Playoff } from "./playoff";

const baseSeason = postseasonSeasonSchema.parse(seasonFile);
const texas = teamConfigs["texas-football"];
const utahState = teamConfigs["utah-state-football"];

// Records are explicit: the shared test setup freezes schedules before any
// games were played.
function schedule(wins: number, losses: number): TeamSchedule {
  const outcomes = [...Array(wins).fill("W"), ...Array(losses).fill("L"), ...Array(12 - wins - losses).fill(null)];
  return {
    teamSlug: "example-football", teamName: "Example", teamDisplayName: "Example football", seasonYear: 2026,
    sourceUrl: "https://example.edu/schedule", capturedAt: "2026-10-06T12:00:00.000Z", timeZone: "America/Chicago",
    games: outcomes.map((outcome, index): ScheduleGame => ({
      id: `g${index}`, opponent: `Opponent ${index}`, site: "home", dateLabel: "Saturday", startsAt: null, date: null,
      status: outcome ? "final" : "scheduled", kickoff: "TBD", venue: "Stadium", tv: null, opponentClassification: "fbs",
      ...(outcome ? { result: outcome === "W" ? { teamScore: 21, opponentScore: 7 } : { teamScore: 7, opponentScore: 21 } } : {}),
    })),
  };
}
function tracker(season: PostseasonSeason, committee?: CommitteeRanking, today = "2026-10-06"): PlayoffTracker {
  const editions = [texas, utahState].map((team) => ({
    team,
    outlook: teamPostseason({ team, schedule: team === texas ? schedule(4, 0) : schedule(1, 4), season, committee, apRank: team === texas ? 1 : null, today }),
  }));
  return { season, today, committee, editions, nextMilestone: { date: "2026-11-03", label: "First rankings" } };
}
function committee(): CommitteeRanking {
  const names = ["Georgia", "Texas", "Ohio State", "Indiana", ...Array.from({ length: 21 }, (_, index) => `School ${index + 5}`)];
  return {
    season: 2026, week: 10, weekLabel: "Week 10", releasedAt: "2026-11-03", capturedAt: "2026-11-04T03:00:00.000Z",
    sourceUrl: "https://www.ncaa.com/rankings/football/fbs/college-football-playoff",
    ranks: names.map((team, index) => ({ rank: index + 1, team, record: "8-1" })),
    provenance: { provider: "espn", sourceUrl: "https://site.api.espn.com/", retrievedAt: "2026-11-04T03:00:00.000Z", verifiedUrl: "https://www.ncaa.com/", throughDate: "2026-11-01" },
  };
}

describe("playoff page", () => {
  it("before the committee ranks anyone, says when it will and does not stand a poll in for it", () => {
    render(<Playoff tracker={tracker(baseSeason)} />);
    expect(screen.getByRole("heading", { level: 1, name: "The playoff race" })).toBeVisible();
    expect(screen.getByText(/Media polls are not the committee/)).toBeVisible();
    expect(screen.getByRole("group", { name: /Next: First rankings/ })).toBeVisible();
    const cards = screen.getByRole("heading", { name: "Our teams" }).closest("section")!;
    expect(within(cards).getByRole("link", { name: /Texas football/ })).toHaveAttribute("href", "/teams/texas-football#postseason");
    expect(within(cards).getByRole("link", { name: /Utah State football/ })).toHaveTextContent(/Bowl race/);
    expect(screen.getByText(/highest-ranked team from the American, Conference USA, MAC, Mountain West, Pac-12 and Sun Belt/)).toBeVisible();
    expect(screen.getByRole("link", { name: /NCAA.com: How the College Football Playoff works/ })).toHaveAttribute("href", expect.stringContaining("ncaa.com"));
  });

  it("groups a verified committee ranking at the bye and field lines and marks our editions in text", () => {
    render(<Playoff tracker={tracker(baseSeason, committee(), "2026-11-05")} />);
    const top = screen.getByRole("list", { name: /Top 4/ });
    expect(within(top).getAllByRole("listitem")).toHaveLength(4);
    expect(within(top).getByRole("link", { name: "Texas" })).toHaveAttribute("href", "/teams/texas-football#postseason");
    expect(within(screen.getByRole("list", { name: /5 to 12/ })).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText(/A rank is not a seed/)).toBeVisible();
  });

  it("shows the announced bracket once the field is confirmed", () => {
    const seeds = Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, team: index === 4 ? "Texas" : `Seed ${index + 1}`, bid: "at-large" as const }));
    const season = postseasonSeasonSchema.parse({ ...seasonFile, confirmed: { ...seasonFile.confirmed, playoffField: {
      announcedAt: "2026-12-06T18:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/", seeds } } });
    render(<Playoff tracker={tracker(season, committee(), "2026-12-07")} />);
    expect(screen.getByRole("heading", { name: "The field" })).toBeVisible();
    expect(within(screen.getByRole("list", { name: "First round" })).getAllByRole("listitem")[0]).toHaveTextContent("Texas hosts No. 12 Seed 12");
    expect(screen.getAllByText(/No\. 5 seed, hosting No\. 12 in the first round\./).length).toBeGreaterThan(0);
  });

  it("renders without a season file instead of carrying last year's format forward", () => {
    render(<Playoff tracker={undefined} />);
    expect(screen.getByText(/rules have not been posted/)).toBeVisible();
  });
});
