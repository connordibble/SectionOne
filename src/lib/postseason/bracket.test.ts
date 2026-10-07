// @vitest-environment node
import { describe, expect, it } from "vitest";
import seasonFile from "../../../data/facts/postseason/2026.json";
import { buildBracket } from "./bracket";
import { postseasonSeasonSchema } from "./season";

const season = postseasonSeasonSchema.parse(seasonFile);
const teams = ["Indiana", "Georgia", "Texas", "Notre Dame", "Miami", "Ohio State", "Alabama", "BYU", "Ole Miss", "Oregon", "Tulane", "Oklahoma"];
const announced = postseasonSeasonSchema.parse({ ...seasonFile, confirmed: { ...seasonFile.confirmed, playoffField: {
  announcedAt: "2026-12-06T18:00:00.000Z", sourceUrl: "https://collegefootballplayoff.com/",
  seeds: teams.map((team, index) => ({ seed: index + 1, team, bid: "at-large" })),
} } });
const pairs = (round: ReturnType<typeof buildBracket>[number]) =>
  round.games.map((game) => game.slots.map((slot) => slot.seed ?? slot.from?.join("/")));

describe("bracket", () => {
  it("draws the published pairings in drawing order, seeds only, before Selection Day", () => {
    const [first, quarters, semis, final] = buildBracket(season, ["Texas"]);
    expect(pairs(first)).toEqual([[8, 9], [5, 12], [7, 10], [6, 11]]);
    expect(pairs(quarters)).toEqual([[1, "8/9"], [4, "5/12"], [2, "7/10"], [3, "6/11"]]);
    expect(pairs(semis)).toEqual([["1/8/9", "4/5/12"], ["2/7/10", "3/6/11"]]);
    expect(final.games).toHaveLength(1);
    expect([first, quarters, semis, final].flatMap((round) => round.games).some((game) => game.onRoad)).toBe(false);
    expect(first.games[0].slots[0]).toEqual({ seed: 8 });
    expect(quarters.dates).toEqual(["2026-12-30", "2027-01-01"]);
  });

  it("fills announced teams and traces only the edition team's road", () => {
    const rounds = buildBracket(announced, ["Ohio State", "Buckeyes"]);
    const road = rounds.map((round) => round.games.filter((game) => game.onRoad).map((game) => game.id));
    expect(road).toEqual([["first-6-11"], ["quarter-3"], ["semi-2-3"], ["final"]]);
    expect(rounds[0].games[3].slots[0]).toEqual({ seed: 6, team: "Ohio State", isTeam: true });
    const bye = buildBracket(announced, ["Texas"]);
    expect(bye.map((round) => round.games.filter((game) => game.onRoad).length)).toEqual([0, 1, 1, 1]);
    expect(buildBracket(announced, ["Utah State"]).flatMap((round) => round.games).some((game) => game.onRoad)).toBe(false);
  });

  it("refuses a bracket that drops or repeats a seed", () => {
    const broken = structuredClone(seasonFile);
    broken.playoff.bracket.firstRound[0] = [8, 8];
    expect(postseasonSeasonSchema.safeParse(broken).success).toBe(false);
    const orphan = structuredClone(seasonFile);
    orphan.playoff.bracket.quarterfinals[0].against = [6, 11];
    expect(postseasonSeasonSchema.safeParse(orphan).success).toBe(false);
    const semis = structuredClone(seasonFile);
    semis.playoff.bracket.semifinals = [[1, 2], [1, 3]];
    expect(postseasonSeasonSchema.safeParse(semis).success).toBe(false);
  });
});
