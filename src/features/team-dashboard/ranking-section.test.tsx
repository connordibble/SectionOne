import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RankedOpponent, TeamRankingSummary } from "@/server/sources/rankings";
import { RankingSection } from "./ranking-section";

function opponent(overrides: Partial<RankedOpponent> = {}): RankedOpponent {
  return { gameId: "one", opponent: "Opponent", rank: 5, site: "home", dateLabel: "Saturday, September 5",
    status: "scheduled", phase: "upcoming", ...overrides };
}
function ranking(opponents: RankedOpponent[]): TeamRankingSummary {
  return { poll: { id: "ap", name: "AP Top 25", releasedAt: "2026-10-04", sourceUrl: "https://example.com/poll", ranks: [] },
    weekLabel: "Week 6", teamRank: null, rankedOpponents: opponents, opponentCount: 12, pending: [], checkedAt: "2026-10-06T12:00:00Z",
    scheduleSource: { url: "https://example.com/schedule", checkedAt: "2026-10-06T12:00:00Z" } };
}
function show(opponents: RankedOpponent[]) { render(<RankingSection ranking={ranking(opponents)} teamName="Team" />); }

describe("ranked opponent groups", () => {
  it("separates upcoming games from played results and keeps team-perspective scores accessible", () => {
    show([opponent({ opponent: "Future" }), opponent({ gameId: "past", opponent: "Past", phase: "played", status: "final", result: { teamScore: 24, opponentScore: 23 } })]);
    expect(within(screen.getByRole("list", { name: /Upcoming/ })).getByText("vs Future")).toBeVisible();
    const played = screen.getByRole("list", { name: /Played/ });
    expect(within(played).getByText("vs Past")).toBeVisible();
    expect(played).toHaveTextContent("W Win: 24–23");
    expect(screen.getByText("Upcoming opponents use this AP poll. Played opponents use their AP rank at kickoff.", { exact: false })).toBeVisible();
    expect(screen.getByRole("link", { name: /Results checked/ })).toHaveAttribute("href", "https://example.com/schedule");
  });
  it.each([
    [{ teamScore: 0, opponentScore: 33 }, "L Loss: 0–33"],
    [{ teamScore: 0, opponentScore: 0 }, "T Tie: 0–0"],
  ] as const)("preserves zero scores and outcome meaning", (result, text) => {
    show([opponent({ phase: "played", status: "final", result })]);
    expect(screen.getByRole("list", { name: /Played/ })).toHaveTextContent(text);
    expect(screen.queryByRole("heading", { name: /Upcoming/ })).not.toBeInTheDocument();
  });
  it("shows a final label without inventing an unavailable score", () => {
    show([opponent({ phase: "played", status: "final" })]);
    expect(screen.getByText("Final")).toBeVisible();
    expect(screen.queryByText(/0–0/)).not.toBeInTheDocument();
  });
  it("labels live, postponed, cancelled and overdue games separately", () => {
    show([opponent({ phase: "updates", status: "in-progress" }),
      opponent({ gameId: "two", phase: "updates", status: "postponed" }),
      opponent({ gameId: "three", phase: "updates", status: "cancelled" }),
      opponent({ gameId: "four", phase: "updates", status: "scheduled" })]);
    expect(screen.getByRole("list", { name: /Game updates/ }).children).toHaveLength(4);
    for (const label of ["In progress", "Postponed", "Cancelled", "Result pending"]) expect(screen.getByText(label)).toBeVisible();
    expect(screen.queryByRole("heading", { name: /Played/ })).not.toBeInTheDocument();
  });
  it("does not hide played opponents behind the former five-row cap, including repeat opponents", () => {
    show([...Array.from({ length: 6 }, (_, i) => opponent({ gameId: `future-${i}` })), opponent({ gameId: "past", phase: "played", status: "final" })]);
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("list", { name: /Played/ }).children).toHaveLength(1);
  });
  it("keeps the no-ranked-opponents state free of empty group headings", () => {
    show([]);
    expect(screen.getByText("No ranked opponents on the Team schedule.")).toBeVisible();
    expect(screen.queryAllByRole("list")).toHaveLength(0);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });
});
