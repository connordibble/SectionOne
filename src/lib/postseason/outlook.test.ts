// @vitest-environment node
import { describe, expect, it } from "vitest";
import seasonFile from "../../../data/facts/postseason/2026.json";
import type { ScheduleGame, TeamSchedule } from "@/lib/facts/schedule";
import type { CommitteeRanking } from "./committee";
import { bowlOutlook, contentionLossLimit, seasonRecord, teamPostseason, type OutlookInput } from "./outlook";
import { postseasonSeasonSchema, type PostseasonSeason } from "./season";

const season = postseasonSeasonSchema.parse(seasonFile);

type GameSpec = { result?: "W" | "L" | "pending"; status?: ScheduleGame["status"]; kind?: ScheduleGame["opponentClassification"] | null };
function schedule(specs: GameSpec[]): TeamSchedule {
  return {
    teamSlug: "example-football", teamName: "Example", teamDisplayName: "Example football", seasonYear: 2026,
    sourceUrl: "https://example.edu/schedule", capturedAt: "2026-10-06T12:00:00.000Z", timeZone: "America/Chicago",
    games: specs.map((spec, index) => {
      const status = spec.status ?? (spec.result ? "final" : "scheduled");
      const game: ScheduleGame = {
        id: `g${index}`, opponent: `Opponent ${index}`, site: "home", dateLabel: "Saturday", startsAt: null, date: null,
        status, kickoff: "TBD", venue: "Stadium", tv: null,
      };
      if (spec.kind !== null) game.opponentClassification = spec.kind ?? "fbs";
      if (spec.result === "W") game.result = { teamScore: 30, opponentScore: 10 };
      if (spec.result === "L") game.result = { teamScore: 10, opponentScore: 30 };
      return game;
    }),
  };
}
const games = (wins: number, losses: number, remaining: number): GameSpec[] => [
  ...Array.from({ length: wins }, () => ({ result: "W" as const })),
  ...Array.from({ length: losses }, () => ({ result: "L" as const })),
  ...Array.from({ length: remaining }, () => ({})),
];

const team = { slug: "example-football", shortName: "Example", displayName: "Example football", aliases: ["Examples"], conference: "SEC" };
function input(overrides: Partial<OutlookInput> = {}): OutlookInput {
  return { team, schedule: schedule(games(4, 1, 7)), season, apRank: null, today: "2026-10-06", ...overrides };
}
function committee(teams: string[], overrides: Partial<CommitteeRanking> = {}): CommitteeRanking {
  const names = [...teams, ...Array.from({ length: 25 }, (_, index) => `Filler ${index}`)].slice(0, 25);
  return {
    season: 2026, week: 10, weekLabel: "Week 10", releasedAt: "2026-11-03", capturedAt: "2026-11-04T03:00:00.000Z",
    sourceUrl: "https://www.ncaa.com/rankings/football/fbs/college-football-playoff",
    ranks: names.map((name, index) => ({ rank: index + 1, team: name, record: "8-1" })),
    provenance: { provider: "espn", sourceUrl: "https://site.api.espn.com/", retrievedAt: "2026-11-04T03:00:00.000Z",
      verifiedUrl: "https://www.ncaa.com/", throughDate: "2026-11-01" },
    ...overrides,
  };
}
function withConfirmed(confirmed: Partial<PostseasonSeason["confirmed"]>): PostseasonSeason {
  return postseasonSeasonSchema.parse({ ...season, confirmed: { ...season.confirmed, ...confirmed } });
}

describe("season rules", () => {
  it("encodes the 2026 format and refuses an inconsistent calendar or field", () => {
    expect(season.playoff.fieldSize).toBe(12);
    expect(season.playoff.championBids).toEqual(["ACC", "Big 12", "Big Ten", "SEC"]);
    expect(season.playoff.groupBid.conferences).toContain("Pac-12");
    const wrongDay = { ...seasonFile, playoff: { ...seasonFile.playoff, selectionDay: "2026-12-07" } };
    expect(postseasonSeasonSchema.safeParse(wrongDay).success).toBe(false);
    const shortField = { ...seasonFile, confirmed: { ...seasonFile.confirmed, playoffField: {
      announcedAt: "2026-12-06T20:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/",
      seeds: [{ seed: 1, team: "Example", bid: "automatic" }] } } };
    expect(postseasonSeasonSchema.safeParse(shortField).success).toBe(false);
    const unknownSource = { ...seasonFile, bowls: { ...seasonFile.bowls, sourceIds: ["nope"] } };
    expect(postseasonSeasonSchema.safeParse(unknownSource).success).toBe(false);
  });
});

describe("bowl eligibility", () => {
  it("is eligible at six counted wins and alive while enough countable games remain", () => {
    expect(bowlOutlook(schedule(games(6, 2, 4)), season.bowls).state).toBe("eligible");
    const alive = bowlOutlook(schedule(games(1, 4, 7)), season.bowls);
    expect(alive).toMatchObject({ state: "alive", countedWins: 1, winsNeeded: 5, countableGamesLeft: 7, reachableWins: 8 });
  });

  it("counts one FCS win and no lower-division wins", () => {
    const twoFcs = schedule([{ result: "W", kind: "fcs" }, { result: "W", kind: "fcs" }, ...games(4, 2, 4)]);
    expect(bowlOutlook(twoFcs, season.bowls)).toMatchObject({ state: "alive", countedWins: 5, extraFcsWins: 1 });
    const lower = schedule([{ result: "W", kind: "lower-division" }, ...games(5, 2, 4)]);
    expect(bowlOutlook(lower, season.bowls)).toMatchObject({ state: "alive", countedWins: 5 });
    // A remaining FCS game cannot add a counted win once the FCS win is used.
    const fcsLeft = schedule([{ result: "W", kind: "fcs" }, ...games(4, 6, 0), { kind: "fcs" }]);
    expect(bowlOutlook(fcsLeft, season.bowls)).toMatchObject({ state: "out", countableGamesLeft: 0 });
  });

  it("never treats an unclassified win as counted", () => {
    const unclassified = schedule([{ result: "W", kind: null }, ...games(5, 3, 3)]);
    expect(bowlOutlook(unclassified, season.bowls)).toMatchObject({ state: "unconfirmed", countedWins: 5, unclassifiedWins: 1 });
  });

  it("is out when six counted wins are unreachable, and says whether 5-7 is still possible", () => {
    expect(bowlOutlook(schedule(games(1, 7, 4)), season.bowls)).toMatchObject({ state: "out", alternateStillPossible: true });
    expect(bowlOutlook(schedule(games(2, 8, 2)), season.bowls)).toMatchObject({ state: "out", alternateStillPossible: false });
  });

  it("does not count a final without a confirmed score, and skips cancelled games", () => {
    const pending = schedule([...games(5, 1, 0), { status: "final", result: "pending" }, ...games(0, 0, 5)]);
    expect(seasonRecord(pending)).toMatchObject({ wins: 5, losses: 1, pendingResults: 1, remainingGames: 5 });
    expect(bowlOutlook(pending, season.bowls)).toMatchObject({ state: "alive", countedWins: 5, countableGamesLeft: 6 });
    const cancelled = schedule([...games(2, 4, 4), { status: "cancelled" }, { status: "cancelled" }]);
    expect(bowlOutlook(cancelled, season.bowls)).toMatchObject({ state: "alive", countableGamesLeft: 4 });
  });

  it("reports a schedule longer than the rule covers as unknown rather than guessing", () => {
    expect(bowlOutlook(schedule(games(6, 0, 7)), season.bowls).state).toBe("unknown");
  });
});

describe("playoff outlook and the bowl fallback", () => {
  it(`before the committee ranks, leads with the playoff while ranked or within ${contentionLossLimit} losses`, () => {
    expect(teamPostseason(input()).lead).toBe("playoff");
    const twoLosses = teamPostseason(input({ schedule: schedule(games(4, 2, 6)) }));
    expect(twoLosses).toMatchObject({ lead: "playoff", playoff: { phase: "before-rankings", standing: "in-picture" } });
    const threeLosses = teamPostseason(input({ schedule: schedule(games(4, 3, 5)) }));
    expect(threeLosses).toMatchObject({ lead: "bowl", playoff: { standing: "outside", path: "champion" } });
    const rankedThreeLosses = teamPostseason(input({ schedule: schedule(games(4, 3, 5)), apRank: 22 }));
    expect(rankedThreeLosses.lead).toBe("playoff");
  });

  it("names the next committee release and flags one that has passed without a verified ranking", () => {
    expect(teamPostseason(input()).playoff.nextRanking).toEqual({ date: "2026-11-03", label: "First rankings" });
    expect(teamPostseason(input({ today: "2026-11-03" })).playoff.rankingBehind).toBeUndefined();
    const overdue = teamPostseason(input({ today: "2026-11-04" })).playoff;
    expect(overdue).toMatchObject({ phase: "before-rankings", rankingBehind: { date: "2026-11-03" } });
  });

  it("switches to the committee's top 25 once one is verified, in both directions", () => {
    const ranked = teamPostseason(input({ committee: committee(["Leader", "Examples"]), today: "2026-11-05" }));
    expect(ranked).toMatchObject({ lead: "playoff", playoff: { phase: "rankings", committeeRank: 2, standing: "in-picture" } });
    expect(ranked.playoff.nextRanking?.date).toBe("2026-11-10");
    const unranked = teamPostseason(input({ committee: committee([]), today: "2026-11-05" }));
    expect(unranked).toMatchObject({ lead: "bowl", playoff: { standing: "outside", committeeRank: null } });
  });

  it("ignores a ranking from another season and flags an old one as behind", () => {
    const lastYear = teamPostseason(input({ committee: committee(["Example"], { season: 2025 }), today: "2026-11-05" }));
    expect(lastYear.playoff.phase).toBe("before-rankings");
    const stale = teamPostseason(input({ committee: committee(["Example"]), today: "2026-11-12" }));
    expect(stale.playoff).toMatchObject({ phase: "rankings", rankingBehind: { date: "2026-11-10" } });
  });

  it("reads each conference's path from the season rules", () => {
    expect(teamPostseason(input({ team: { ...team, conference: "Pac-12" } })).playoff.path).toBe("group");
    expect(teamPostseason(input({ team: { ...team, conference: "Independent", shortName: "Notre Dame" } })).playoff.path).toBe("independent");
    expect(teamPostseason(input({ team: { ...team, conference: "Independent" } })).playoff.path).toBe("at-large");
  });

  it("lets a confirmed field and bowl selection supersede every projection", () => {
    const seeds = Array.from({ length: 12 }, (_, index) => ({ seed: index + 1, team: index === 2 ? "Example" : `Seed ${index + 1}`, bid: "at-large" as const }));
    const field = { announcedAt: "2026-12-06T20:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/", seeds };
    const selected = teamPostseason(input({ season: withConfirmed({ playoffField: field }), committee: committee([]), today: "2026-12-07" }));
    expect(selected).toMatchObject({ lead: "playoff", playoff: { phase: "field-set", standing: "in-field", seed: { seed: 3 } } });
    const bowl = { team: "Example", bowl: "Example Bowl", date: "2026-12-26", opponent: "Rival",
      announcedAt: "2026-12-06T23:00:00.000Z", sourceUrl: "https://example.com/bowls" };
    const left = teamPostseason(input({
      season: withConfirmed({ playoffField: { ...field, seeds: seeds.map((entry) => ({ ...entry, team: `Seed ${entry.seed}` })) }, bowlSelections: [bowl] }),
      committee: committee(["Example"]), apRank: 9, today: "2026-12-07",
    }));
    expect(left).toMatchObject({ lead: "bowl", playoff: { standing: "not-selected" }, bowl: { state: "selected", selection: { bowl: "Example Bowl" } } });
  });
});
