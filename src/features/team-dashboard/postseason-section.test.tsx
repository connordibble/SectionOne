import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import seasonFile from "../../../data/facts/postseason/2026.json";
import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import { teamPostseason, type OutlookInput } from "@/lib/postseason/outlook";
import { postseasonSeasonSchema } from "@/lib/postseason/season";
import { PostseasonSection } from "./postseason-section";

const season = postseasonSeasonSchema.parse(seasonFile);
function schedule(wins: number, losses: number, remaining: number): TeamSchedule {
  const outcomes = [...Array(wins).fill("W"), ...Array(losses).fill("L"), ...Array(remaining).fill(null)];
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
function show(overrides: Partial<OutlookInput>) {
  const outlook = teamPostseason({
    team: { slug: "example-football", shortName: "Example", displayName: "Example football", aliases: [], conference: "Pac-12" },
    schedule: schedule(4, 1, 7), season, apRank: null, today: "2026-10-06", ...overrides,
  });
  render(<PostseasonSection outlook={outlook} teamName="Example" />);
}

describe("postseason section", () => {
  it("leads with the playoff race in the picture and keeps the bowl count below it", () => {
    show({});
    expect(screen.getByRole("heading", { name: "Postseason" })).toBeVisible();
    expect(screen.getByText("Playoff race")).toBeVisible();
    expect(screen.getByText(/Unranked in the AP poll, one loss\. In the picture\./)).toBeVisible();
    expect(screen.getByText(/Two more wins to reach six/)).toBeVisible();
    expect(screen.getByText(/highest-ranked Group of 6 team, champion or not/)).toBeVisible();
    expect(screen.getByText(/not a forecast/)).toBeVisible();
    expect(screen.getByRole("link", { name: "See the full playoff race" })).toHaveAttribute("href", "/playoff");
  });

  it("falls back to the bowl race outside the picture without dropping the playoff path", () => {
    show({ schedule: schedule(1, 4, 7) });
    expect(screen.getByText("Bowl race")).toBeVisible();
    expect(screen.getByText("wins to go", { exact: false })).toBeVisible();
    expect(screen.getByText(/Outside the picture/)).toBeVisible();
    expect(screen.getByText(/Five more wins to reach six, with seven games left\./)).toBeVisible();
    expect(screen.queryByRole("term", { name: "Bowl" })).not.toBeInTheDocument();
    expect(screen.getByText("Path")).toBeVisible();
  });

  it("says when a committee release has not been checked rather than presenting older data as current", () => {
    show({ today: "2026-11-05" });
    expect(screen.getByText(/The Tue, Nov 3 committee rankings have not been checked yet\./)).toBeVisible();
  });
});
