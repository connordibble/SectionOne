// @vitest-environment node
import { describe, expect, it } from "vitest";
import { teamConfigs } from "@/config/team";
import { buildTeamSchedule, formatKickoff, type CfbdScheduleGame } from "./cfbd-schedule";

const team = teamConfigs["utah-state-football"];
const timeZone = "America/Denver";

// Shaped like a CollegeFootballData /games response. Out of order and with an
// unrelated game mixed in, because that is what the endpoint actually returns
// when a query is loose.
const games: CfbdScheduleGame[] = [
  {
    id: 401,
    season: 2026,
    week: 2,
    startDate: "2026-09-12T23:15:00.000Z",
    homeTeam: "Washington",
    awayTeam: "Utah State",
    venue: "Husky Stadium",
  },
  {
    id: 400,
    season: 2026,
    week: 1,
    startDate: "2026-09-05T23:00:00.000Z",
    homeTeam: "Utah State",
    awayTeam: "Idaho State",
    venue: "Maverik Stadium",
  },
  {
    id: 402,
    season: 2026,
    week: 14,
    startDate: "2026-11-28T00:00:00.000Z",
    startTimeTBD: true,
    homeTeam: "Utah State",
    awayTeam: "Opponent TBA",
    venue: "Maverik Stadium",
  },
  {
    id: 999,
    season: 2026,
    week: 1,
    startDate: "2026-09-05T23:00:00.000Z",
    homeTeam: "Boise State",
    awayTeam: "Nevada",
    venue: "Albertsons Stadium",
  },
];

function build(overrides: Partial<Parameters<typeof buildTeamSchedule>[0]> = {}) {
  return buildTeamSchedule({
    team,
    games,
    timeZone,
    sourceUrl: "https://utahstateaggies.com/sports/football/schedule/2026",
    capturedAt: "2026-08-08T16:00:00.000Z",
    ...overrides,
  });
}

describe("buildTeamSchedule", () => {
  it("keeps only this team's games and puts them in playing order", () => {
    const schedule = build();

    expect(schedule.games.map((game) => game.opponent)).toEqual([
      "Idaho State",
      "Washington",
      "Opponent TBA",
    ]);
    expect(schedule.teamSlug).toBe("utah-state-football");
    expect(schedule.seasonYear).toBe(2026);
  });

  it("reads home and away from the team's side of the fixture", () => {
    const schedule = build();

    expect(schedule.games[0].site).toBe("home");
    expect(schedule.games[1].site).toBe("away");
  });

  it("marks a neutral-site game as neutral rather than home", () => {
    const schedule = build({
      games: [
        {
          id: 500,
          season: 2026,
          week: 5,
          startDate: "2026-10-03T23:30:00.000Z",
          homeTeam: "Utah State",
          awayTeam: "Boise State",
          neutralSite: true,
          venue: "Somewhere Neutral",
        },
      ],
    });

    expect(schedule.games[0].site).toBe("neutral");
  });

  // The whole point of sourcing from the API is that a fan-facing time is not
  // retyped. Every game is rendered in the team's own zone, road games
  // included, because a fan wants to know when to turn the TV on.
  it("renders kickoff in the team's home zone in house style", () => {
    const schedule = build();

    expect(schedule.games[0].kickoff).toBe("5 p.m. MT");
    expect(schedule.games[0].dateLabel).toBe("Saturday, September 5");
    expect(schedule.games[1].kickoff).toBe("5:15 p.m. MT");
  });

  // CFBD ships a placeholder timestamp alongside startTimeTBD. Rendering it as
  // a real kickoff is how a schedule quietly starts lying.
  it("refuses to invent a kickoff for a game flagged TBD", () => {
    const schedule = build();
    const flexGame = schedule.games[2];

    expect(flexGame.startsAt).toBeNull();
    expect(flexGame.kickoff).toBe("still to be announced");
  });

  it("attaches TV outlets and ignores radio and web entries", () => {
    const schedule = build({
      media: [
        { id: 400, mediaType: "tv", outlet: "CBS Sports Network" },
        { id: 400, mediaType: "radio", outlet: "Aggie Radio" },
        { id: 401, mediaType: "web", outlet: "Some Stream" },
      ],
    });

    expect(schedule.games[0].tv).toBe("CBS Sports Network");
    expect(schedule.games[1].tv).toBeNull();
  });

  it("builds stable ids from the season and both team names", () => {
    expect(build().games[0].id).toBe("2026-utah-state-idaho-state");
  });
});

describe("formatKickoff", () => {
  // MDT and MST are the same thing to a fan planning a Saturday, and a
  // schedule that switches labels mid-November reads like a bug.
  it("uses one generic zone label on both sides of the clock change", () => {
    expect(formatKickoff(new Date("2026-10-09T01:00:00.000Z"), timeZone)).toBe("7 p.m. MT");
    expect(formatKickoff(new Date("2026-11-08T02:30:00.000Z"), timeZone)).toBe("7:30 p.m. MT");
  });

  it("drops the minutes on the hour and lowercases the meridiem", () => {
    expect(formatKickoff(new Date("2026-09-05T17:00:00.000Z"), "America/Chicago")).toBe(
      "12 p.m. CT",
    );
  });
});
