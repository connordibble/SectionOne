import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import { SchedulePreview } from "./schedule-preview";

const game: ScheduleGame = {
  id: "game", opponent: "Opponent", dateLabel: "Saturday, September 5", date: "2026-09-05",
  startsAt: null, site: "away", status: "scheduled", kickoff: "6 p.m. CT", venue: "Stadium", tv: "ABC",
};
function show(overrides: Partial<ScheduleGame> = {}, variant: "full" | "compact" = "full") {
  const schedule: TeamSchedule = {
    teamSlug: "team", teamName: "Team", teamDisplayName: "Team football", seasonYear: 2026,
    sourceUrl: "https://example.com/schedule", capturedAt: "2026-10-06T12:00:00Z", timeZone: "America/Chicago",
    games: [{ ...game, ...overrides }],
  };
  render(<SchedulePreview schedule={schedule} variant={variant} nextGameId="game" />);
}

describe("schedule results", () => {
  it.each([
    [{ teamScore: 24, opponentScore: 23 }, "W Win: 24–23"],
    [{ teamScore: 0, opponentScore: 33 }, "L Loss: 0–33"],
    [{ teamScore: 0, opponentScore: 0 }, "T Tie: 0–0"],
  ])("replaces completed games' broadcast windows with an accessible final result", (result, text) => {
    show({ status: "final", result });
    expect(screen.getByRole("listitem")).toHaveTextContent(text);
    expect(screen.getByText("Final")).toBeVisible();
    expect(screen.queryByText("6 p.m. CT")).not.toBeInTheDocument();
    expect(screen.queryByText("ABC")).not.toBeInTheDocument();
    expect(screen.getByText("Stadium")).toBeVisible();
  });
  it("labels completed games without inventing a missing score", () => {
    show({ status: "final" });
    expect(screen.getByText("Final")).toBeVisible();
    expect(screen.queryByText(/0–0/)).not.toBeInTheDocument();
    expect(screen.queryByText("TV TBD")).not.toBeInTheDocument();
  });
  it.each(["scheduled", "in-progress", "postponed", "cancelled"] as const)("keeps %s games free of a final result", (status) => {
    show({ status });
    expect(screen.queryByText("Final")).not.toBeInTheDocument();
    expect(screen.getByText("ABC")).toBeVisible();
    expect(screen.getByText(status === "cancelled" ? "Cancelled" : status === "postponed" ? "Postponed" : "6 p.m. CT")).toBeVisible();
  });
  it("keeps completed games out of Next three", () => {
    show({ status: "final", result: { teamScore: 24, opponentScore: 23 } }, "compact");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
