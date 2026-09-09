import { describe, expect, it } from "vitest";
import {
  formatCaptureDate,
  formatSite,
  getKickoffCountdown,
  getNextGame,
  getTeamSchedule,
  getUpcomingGames,
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
    const next = getNextGame("texas-football", new Date("2026-09-13T06:00:00Z"));

    expect(next?.opponent).toBe("UTSA");
  });

  it("keeps a game available on game day and never revives past TBD games after the season", () => {
    expect(getNextGame("texas-football", new Date("2026-09-12T23:45:00Z"))?.opponent).toBe("Ohio State");
    for (const slug of ["texas-football", "utah-state-football", "ohio-state-football", "lsu-football"]) {
      expect(getNextGame(slug, new Date("2027-02-01T00:00:00Z"))).toBeUndefined();
    }
  });

  it("uses calendar dates for TBD kickoffs and excludes final, postponed and cancelled games", () => {
    const schedule = structuredClone(getTeamSchedule("ohio-state-football")!);
    const base = schedule.games[0];
    schedule.games = [
      { ...base, id: "past", date: "2026-09-07", startsAt: null },
      { ...base, id: "postponed", date: "2026-09-09", status: "postponed" },
      { ...base, id: "cancelled", date: "2026-09-09", status: "cancelled" },
      { ...base, id: "final", date: "2026-09-09", status: "final" },
      { ...base, id: "unknown", date: null, startsAt: null },
      { ...base, id: "future", date: "2026-09-12", startsAt: null },
    ];
    expect(getUpcomingGames(schedule, new Date("2026-09-08T12:00:00Z")).map((game) => game.id)).toEqual(["future"]);
  });

  it("formats site and capture date consistently", () => {
    expect(formatSite("home")).toBe("vs");
    expect(formatSite("neutral")).toBe("vs");
    expect(formatSite("away")).toBe("at");
    expect(formatCaptureDate("2026-07-01T13:55:00.000Z")).toBe("July 1, 2026");
  });

  it("keeps Utah State's official Washington and San Diego State kickoff times", () => {
    const schedule = getTeamSchedule("utah-state-football");
    const washington = schedule?.games.find((game) => game.opponent === "Washington");
    const sanDiegoState = schedule?.games.find((game) => game.opponent === "San Diego State");

    expect(washington).toMatchObject({
      startsAt: "2026-09-12T13:30:00-06:00",
      kickoff: "1:30 p.m. MT",
      tv: "Big Ten Network",
    });
    expect(sanDiegoState).toMatchObject({
      startsAt: "2026-11-14T19:30:00-07:00",
      kickoff: "7:30 p.m. MT",
      tv: "USA Network",
    });
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

  it("does not label an old game as today", () => {
    const result = getKickoffCountdown(game, new Date("2026-09-20T06:00:00Z"));

    expect(result).toEqual({ state: "unscheduled" });
  });

  it("counts calendar days in the fan's timezone across UTC midnight and daylight saving", () => {
    expect(getKickoffCountdown({ startsAt: "2026-09-06T01:00:00Z" }, new Date("2026-09-05T23:00:00Z"), "America/Chicago")).toEqual({ state: "today" });
    expect(getKickoffCountdown({ startsAt: "2026-11-02T01:00:00Z" }, new Date("2026-11-01T04:00:00Z"), "America/Chicago")).toEqual({ state: "scheduled", days: 1 });
  });

  // The lead figure must never be invented — a game with no kickoff time has
  // no countdown, and "TBD" is the honest answer.
  it("refuses to invent a countdown for an unscheduled game", () => {
    expect(getKickoffCountdown({ startsAt: null })).toEqual({ state: "unscheduled" });
    expect(getKickoffCountdown(undefined)).toEqual({ state: "unscheduled" });
    expect(getKickoffCountdown({ startsAt: "not-a-date" })).toEqual({ state: "unscheduled" });
  });
});
