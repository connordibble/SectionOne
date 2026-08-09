import { describe, expect, it } from "vitest";
import {
  formatCaptureDate,
  formatSite,
  getKickoffCountdown,
  getNextGame,
  getTeamSchedule,
} from "./schedule";

describe("team schedule", () => {
  it("loads the Texas fixture and ignores unknown teams", () => {
    const schedule = getTeamSchedule("texas-football");

    expect(schedule?.teamName).toBe("Texas");
    expect(schedule?.teamDisplayName).toBe("Texas football");
    expect(schedule?.games.length).toBe(12);
    expect(getTeamSchedule("nope-football")).toBeUndefined();
  });

  it("derives the next game from the schedule ahead of the season", () => {
    const next = getNextGame("texas-football", new Date("2026-07-01T00:00:00Z"));

    expect(next?.opponent).toBe("Texas State");
    expect(getNextGame("nope-football")).toBeUndefined();
  });

  it("advances the next game past kickoffs that already happened", () => {
    const next = getNextGame("texas-football", new Date("2026-09-13T00:00:00Z"));

    expect(next?.opponent).toBe("UTSA");
  });

  it("formats site and capture date consistently", () => {
    expect(formatSite("home")).toBe("vs");
    expect(formatSite("neutral")).toBe("vs");
    expect(formatSite("away")).toBe("at");
    expect(formatCaptureDate("2026-07-01T13:55:00.000Z")).toBe("July 1, 2026");
  });
});

describe("getKickoffCountdown", () => {
  const game = { startsAt: "2026-09-05T14:30:00-05:00" };

  it("counts whole days out from a scheduled kickoff", () => {
    const result = getKickoffCountdown(game, new Date("2026-08-08T12:00:00Z"));

    expect(result).toEqual({ state: "scheduled", days: 28 });
  });

  // Sleeps, not 24-hour blocks: late the night before is still "tomorrow".
  it("reads the night before kickoff as one day out", () => {
    const result = getKickoffCountdown(game, new Date("2026-09-04T23:30:00Z"));

    expect(result).toEqual({ state: "scheduled", days: 1 });
  });

  it("reports game day once the calendar date arrives", () => {
    const result = getKickoffCountdown(game, new Date("2026-09-05T06:00:00Z"));

    expect(result).toEqual({ state: "today" });
  });

  it("reports game day rather than a negative count after kickoff", () => {
    const result = getKickoffCountdown(game, new Date("2026-09-20T06:00:00Z"));

    expect(result).toEqual({ state: "today" });
  });

  // The lead figure must never be invented — a game with no kickoff time has
  // no countdown, and "TBD" is the honest answer.
  it("refuses to invent a countdown for an unscheduled game", () => {
    expect(getKickoffCountdown({ startsAt: null })).toEqual({ state: "unscheduled" });
    expect(getKickoffCountdown(undefined)).toEqual({ state: "unscheduled" });
    expect(getKickoffCountdown({ startsAt: "not-a-date" })).toEqual({ state: "unscheduled" });
  });
});
