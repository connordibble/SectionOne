// @vitest-environment node
import { expect, it } from "vitest";
import feed from "@/test/fixtures/rankings/texas-ohio-state-2026.json";
import { teamConfigs } from "@/config/team";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { gameDayFeedUrl, verifiedGameDayRank } from "./game-day-ranks";
import type { ScheduleGame } from "@/lib/facts/schedule";
const team = teamConfigs["texas-football"];
const base = getTeamSchedule(team.slug)!.games[0];
const game: ScheduleGame = { ...base, opponent: "Ohio State", date: "2026-09-12", startsAt: "2026-09-12T23:30:00Z", status: "final", result: { teamScore: 24, opponentScore: 23 } };
const now = new Date("2026-10-07T02:00:00Z");
const read = (value: unknown = feed, target = game, season = 2026) => verifiedGameDayRank(value, team, target, season, "America/Chicago", now);
it("reads the archived No. 1 opponent instead of today's rank", () => {
  expect(read()).toMatchObject({ rank: 1, pollId: "ap", gameDate: "2026-09-12", sourceUrl: expect.stringContaining("401856682") });
  expect(gameDayFeedUrl("2026-09-12")).toContain("limit=200");
});
it("matches a schedule abbreviation while still verifying the game and score", () => {
  const copy = JSON.parse(JSON.stringify(feed));
  copy.events[0].competitions[0].competitors[1].team.abbreviation = "OSU";
  expect(read(copy, { ...game, opponent: "OSU" })?.rank).toBe(1);
  expect(read(copy, { ...game, opponent: "LIU" })).toBeUndefined();
  expect(() => read(copy, { ...game, opponent: "OSU", result: { teamScore: 0, opponentScore: 23 } })).toThrow("disagrees");
});
it("distinguishes explicit unranked from missing evidence and rejects invalid ranks", () => {
  const copy = structuredClone(feed);
  const opponent = copy.events[0].competitions[0].competitors[1];
  opponent.curatedRank.current = 99;
  expect(read(copy)?.rank).toBeNull();
  opponent.curatedRank.current = 0;
  expect(() => read(copy)).toThrow("Invalid archived AP rank");
  const missing = JSON.parse(JSON.stringify(feed));
  delete missing.events[0].competitions[0].competitors[1].curatedRank;
  expect(read(missing)).toBeUndefined();
});
it("requires a unique completed game matching the season, date, schools and final scores", () => {
  expect(read(feed, game, 2025)).toBeUndefined();
  expect(read(feed, { ...game, date: "2026-09-19" })).toBeUndefined();
  expect(read(feed, { ...game, opponent: "Oklahoma" })).toBeUndefined();
  expect(read(feed, { ...game, status: "scheduled", result: undefined })).toBeUndefined();
  expect(() => read(feed, { ...game, result: { teamScore: 23, opponentScore: 24 } })).toThrow("disagrees");
  expect(() => read({ events: [feed.events[0], feed.events[0]] })).toThrow("Ambiguous");
});
