// @vitest-environment node
import { describe, expect, it } from "vitest";
import { rankedGamePhase, scheduleGameSchema, type ScheduleGame } from "./schedule";

const game: ScheduleGame = { id: "one", opponent: "Opponent", site: "home", dateLabel: "September 5",
  date: "2026-09-05", startsAt: null, status: "final", kickoff: "TBD", venue: "Stadium", tv: null };

describe("final scores", () => {
  it("accepts zero scores and completed games whose score is unavailable", () => {
    expect(scheduleGameSchema.parse({ ...game, result: { teamScore: 0, opponentScore: 33 } }).result?.teamScore).toBe(0);
    expect(scheduleGameSchema.parse(game).result).toBeUndefined();
  });
  it.each([
    { teamScore: -1, opponentScore: 7 }, { teamScore: 1.5, opponentScore: 7 }, { teamScore: 7 },
  ])("rejects invalid or incomplete final scores: %j", (result) => {
    expect(scheduleGameSchema.safeParse({ ...game, result }).success).toBe(false);
  });
  it.each(["scheduled", "in-progress", "postponed", "cancelled"])("rejects final scores for %s games", (status) => {
    expect(scheduleGameSchema.safeParse({ ...game, status, result: { teamScore: 7, opponentScore: 0 } }).success).toBe(false);
  });
});

describe("ranked game phases", () => {
  it("uses confirmed completion rather than just a past date", () => {
    expect(rankedGamePhase(game, "2026-10-06")).toBe("played");
    expect(rankedGamePhase({ ...game, status: "scheduled" }, "2026-10-06")).toBe("updates");
  });
  it("keeps game day and unknown dates upcoming without inventing a result", () => {
    expect(rankedGamePhase({ status: "scheduled", date: "2026-10-06" }, "2026-10-06")).toBe("upcoming");
    expect(rankedGamePhase({ status: "scheduled", date: null }, "2026-10-06")).toBe("upcoming");
  });
  it.each(["in-progress", "postponed", "cancelled"] as const)("keeps %s games out of played and upcoming", (status) => {
    expect(rankedGamePhase({ status, date: "2026-10-10" }, "2026-10-06")).toBe("updates");
  });
});
