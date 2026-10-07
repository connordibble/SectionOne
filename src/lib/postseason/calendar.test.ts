// @vitest-environment node
import { describe, expect, it } from "vitest";
import seasonFile from "../../../data/facts/postseason/2026.json";
import { postseasonSeasonSchema } from "./season";
import { nextPlayoffMilestone, postseasonTimeline } from "./calendar";

const season = postseasonSeasonSchema.parse(seasonFile);
const field = postseasonSeasonSchema.parse({ ...seasonFile, confirmed: { ...seasonFile.confirmed, playoffField: {
  announcedAt: "2026-12-06T18:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/",
  seeds: Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, team: `Seed ${index + 1}`, bid: "at-large" })),
} } });

describe("next playoff milestone", () => {
  it("counts down to the next committee release before the field is set", () => {
    expect(nextPlayoffMilestone(season, "2026-10-06")).toEqual({ date: "2026-11-03", label: "First rankings" });
  });

  it.each([
    ["2026-12-18", "2026-12-18", "First round"],
    ["2026-12-19", "2026-12-19", "First round"],
    ["2026-12-20", "2026-12-30", "Quarterfinals"],
    ["2027-01-01", "2027-01-01", "Quarterfinals"],
    ["2027-01-15", "2027-01-15", "Semifinals"],
    ["2027-01-16", "2027-01-25", "National championship"],
  ])("on %s it does not skip games still being played", (today, date, label) => {
    expect(nextPlayoffMilestone(field, today)).toEqual({ date, label });
  });

  it("has nothing left after the championship", () => {
    expect(nextPlayoffMilestone(field, "2027-01-26")).toBeUndefined();
  });

  it("marks a timeline of past, current and next entries without inventing any", () => {
    const states = (today: string) => Object.fromEntries(postseasonTimeline(season, today).map((entry) => [entry.label, entry.state]));
    expect(states("2026-10-06")).toMatchObject({ "First rankings": "next", "Second rankings": "later", "National championship": "later" });
    expect(states("2026-11-12")).toMatchObject({ "Second rankings": "past", "Third rankings": "next" });
    expect(states("2026-12-19")).toMatchObject({ "Selection Day": "past", "First round": "now", Quarterfinals: "later" });
    expect(postseasonTimeline(season, "2026-10-06").find((entry) => entry.label === "Selection Day")?.kind).toBe("selection");
  });
});
