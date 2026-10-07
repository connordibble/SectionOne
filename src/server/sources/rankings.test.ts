// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { teamConfigs } from "@/config/team";
import { getRankingDocuments, getTeamRankingSummary } from "./rankings";

import * as schedules from "@/server/schedule/schedule";
import { getBundledPoll } from "@/server/facts/poll-snapshot";
import * as snapshots from "@/server/facts/poll-snapshot";

afterEach(() => vi.restoreAllMocks());

const texas = teamConfigs["texas-football"];
const utahState = teamConfigs["utah-state-football"];

describe("getTeamRankingSummary", () => {
  it("moves an unconfirmed game to updates at midnight in the schedule's time zone", () => {
    const saved = structuredClone(schedules.getTeamSchedule(utahState.slug)!);
    const game = saved.games.find((game) => game.opponent === "Washington")!;
    game.opponentRankAtKickoff = { pollId: "ap", rank: 19, gameDate: game.date!, sourceUrl: "https://example.com/game", checkedAt: "2026-09-13T06:00:00Z" };
    vi.spyOn(schedules, "getTeamSchedule").mockReturnValue(saved);
    const washington = (now: string) => getTeamRankingSummary(utahState, new Date(now))
      ?.rankedOpponents.find((opponent) => opponent.opponent === "Washington");
    expect(washington("2026-09-13T05:59:00Z")?.phase).toBe("upcoming");
    expect(washington("2026-09-13T06:00:00Z")?.phase).toBe("updates");
  });

  it("reports a ranked team's own position", () => {
    expect(getTeamRankingSummary(texas)?.teamRank).toBe(5);
  });

  // Most of the country is unranked, and the section has to say so plainly
  // rather than quietly omitting the line.
  it("reports unranked as unranked", () => {
    expect(getTeamRankingSummary(utahState)?.teamRank).toBeNull();
  });

  // The reason this section is worth building for a team outside the top 25:
  // the useful question is not "who is good" but "which of my weeks are hard".
  it("finds ranked opponents on an unranked team's own schedule", () => {
    const summary = getTeamRankingSummary(utahState);

    expect(summary?.rankedOpponents.map((opponent) => opponent.opponent)).toEqual([
      "Washington",
      "Utah",
    ]);
    expect(summary?.opponentCount).toBe(12);
  });

  it("orders ranked opponents hardest first", () => {
    const ranks = getTeamRankingSummary(texas)?.rankedOpponents.map((game) => game.rank) ?? [];

    expect(ranks.length).toBeGreaterThan(1);
    expect([...ranks].sort((left, right) => left - right)).toEqual(ranks);
  });

  it("matches poll names against the team's aliases, not just its slug", () => {
    // The poll says "Texas"; the config's slug is texas-football.
    expect(getTeamRankingSummary(texas)?.poll.ranks.some((entry) => entry.team === "Texas")).toBe(
      true,
    );
  });

  // A poll that has not been released is not a poll with no one in it. Both
  // preseason polls are out now, so the list is empty rather than absent — the
  // shape still has to carry a promise the product can make again in-season.
  it("carries polls that have not been released yet", () => {
    expect(getTeamRankingSummary(utahState)?.pending).toEqual([]);
  });
});

describe("getRankingDocuments", () => {
  it("states an unranked team's standing without dressing it up", () => {
    const [document] = getRankingDocuments(utahState);

    expect(document.body).toContain("Utah State is not ranked");
    expect(document.body).toContain("No. 17 Washington");
    expect(document.provider).toBe("press");
    expect(document.sourceType).toBe("ranking");
  });

  it("carries a link to the poll it is quoting", () => {
    expect(getRankingDocuments(texas)[0].sourceUrl).toMatch(/^https:\/\//);
  });
});


it("keeps game-day ranks when the current poll changes and never substitutes it for missing history", () => {
  const saved = structuredClone(schedules.getTeamSchedule(texas.slug)!);
  const original = saved.games[0];
  const historical = { pollId: "ap" as const, rank: 1, gameDate: original.date!, sourceUrl: "https://example.com/game", checkedAt: "2026-10-07T01:00:00Z" };
  saved.games = [
    { ...original, id: "ranked-then", opponent: "Ohio State", status: "final", opponentRankAtKickoff: historical, result: { teamScore: 24, opponentScore: 23 } },
    { ...original, id: "unranked-then", opponent: "Georgia", status: "final", opponentRankAtKickoff: { ...historical, rank: null }, result: { teamScore: 21, opponentScore: 0 } },
    { ...original, id: "unknown-then", opponent: "Notre Dame", status: "final", result: { teamScore: 0, opponentScore: 21 } },
  ];
  vi.spyOn(schedules, "getTeamSchedule").mockReturnValue(saved);
  const poll = structuredClone(getBundledPoll(2026)!);
  poll.polls[0].ranks = poll.polls[0].ranks.filter((entry) => entry.team !== "Ohio State");
  vi.spyOn(snapshots, "getPollSnapshot").mockReturnValue(poll);
  const summary = getTeamRankingSummary(texas, new Date("2026-10-07"))!;
  expect(summary.poll.ranks.some((entry) => entry.team === "Ohio State")).toBe(false);
  expect(summary.rankedOpponents.map((game) => [game.opponent, game.rank])).toEqual([["Ohio State", 1]]);
  expect(summary.missingGameDayRanks).toBe(1);
  const documents = getRankingDocuments(texas);
  expect(documents.find((doc) => doc.title.startsWith("AP rank at kickoff"))).toMatchObject({ sourceUrl: "https://example.com/game", body: expect.stringContaining("No. 1 Ohio State") });
});
