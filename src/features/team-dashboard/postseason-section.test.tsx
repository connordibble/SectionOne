import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { teamPostseason } from "@/lib/postseason/outlook";
import { testInput, testSchedule } from "@/test/postseason";
import { PostseasonSection } from "./postseason-section";

describe("Brief postseason summary", () => {
  it("states the live race once, the other in a line, and opens the full view", async () => {
    const onOpen = vi.fn();
    render(<PostseasonSection onOpen={onOpen} outlook={teamPostseason(testInput())} />);
    expect(screen.getByRole("heading", { name: "Postseason" })).toBeVisible();
    expect(screen.getByText("Playoff race")).toBeVisible();
    expect(screen.getByText(/Unranked in the AP poll, one loss\. In the picture\./)).toBeVisible();
    expect(screen.getByText(/Two more wins to reach six/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Bracket, rankings and dates/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("leads with the bowl race outside the picture and keeps the playoff line", () => {
    render(<PostseasonSection onOpen={() => {}} outlook={teamPostseason(testInput({ schedule: testSchedule(1, 4) }))} />);
    expect(screen.getByText("Bowl race")).toBeVisible();
    expect(screen.getByText("wins to go", { exact: false })).toBeVisible();
    expect(screen.getByText(/Outside the picture/)).toBeVisible();
  });
});
