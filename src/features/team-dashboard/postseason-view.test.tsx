import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { postseasonView } from "@/lib/postseason/view";
import { seasonWithField, testCommittee, testInput, testSchedule } from "@/test/postseason";
import { PostseasonView } from "./postseason-view";

function show(overrides: Parameters<typeof testInput>[0] = {}) {
  render(<PostseasonView teamName="Example" view={postseasonView(testInput(overrides))} />);
}

describe("postseason view", () => {
  it("leads with one board: the standing, the next date, and the bowl line as a ladder", () => {
    show({ schedule: testSchedule(1, 4) });
    expect(screen.getByRole("heading", { level: 1, name: "Postseason" })).toBeVisible();
    expect(screen.getByText(/Bowl race · Example/)).toBeVisible();
    expect(screen.getByRole("group", { name: /Next: First rankings, Tue, Nov 3, 28 days out/ })).toBeVisible();
    // Seven games left from one counted win: eight is the ceiling.
    expect(screen.getByRole("img", { name: "1 counted win, bowl eligible at 6, up to 8 still possible." })).toBeVisible();
    expect(screen.getByText("five to go")).toBeVisible();
    expect(screen.getByText("Out of reach")).toBeVisible();
  });

  it("says when the committee will rank teams instead of standing a poll in for it", () => {
    show();
    expect(screen.getByText(/Nothing to rank yet\. The committee's first top 25 comes out Tue, Nov 3\./)).toBeVisible();
    expect(screen.queryByRole("list", { name: /Top 4/ })).not.toBeInTheDocument();
  });

  it("reads the committee ranking from the team outward", () => {
    show({
      committee: testCommittee(["Leader", "Example", "Rival"]), today: "2026-11-05",
      schedule: testSchedule(5, 1, 12, ["Rival", "Nobody", "Nobody", "Nobody", "Nobody", "Nobody", "Later Foe"]),
    });
    const top = screen.getByRole("list", { name: /Top 4/ });
    expect(within(top).getByText("This edition")).toBeVisible();
    expect(within(top).getAllByRole("listitem")[2]).toHaveTextContent(/Rival.*Played.*W Win: 21–7/);
    expect(screen.getByText(/A rank is not a seed/)).toBeVisible();
  });

  it("draws the bracket by seed before Selection Day and by team after, tracing the road", () => {
    show();
    expect(screen.getByText("Seed 12")).toBeVisible();
    expect(screen.getByText(/Teams fill these slots on Selection Day/)).toBeVisible();
  });

  it("retires the qualification path and traces the road once the field is set", () => {
    const season = seasonWithField(["One", "Two", "Example"]);
    const { container } = render(<PostseasonView teamName="Example" view={postseasonView(testInput({ season, committee: testCommittee([]), today: "2026-12-07" }))} />);
    expect(screen.getAllByText(/No\. 3 seed with a first-round bye/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Path")).not.toBeInTheDocument();
    expect(screen.getByText(/Highlighted: the games Example plays in or would reach by winning/)).toBeVisible();
    expect(container.querySelectorAll('[data-road="true"]')).toHaveLength(3);
    expect(container.querySelector('[data-team="true"]')).toHaveTextContent("Example");
  });
});
