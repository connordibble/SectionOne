// @vitest-environment node
import { describe, expect, it } from "vitest";
import { teamConfigs } from "@/config/team";
import { getRankingDocuments, getTeamRankingSummary } from "./rankings";

const texas = teamConfigs["texas-football"];
const utahState = teamConfigs["utah-state-football"];

describe("getTeamRankingSummary", () => {
  it("reports a ranked team's own position", () => {
    expect(getTeamRankingSummary(texas)?.teamRank).toBe(4);
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

  // A poll that has not been released is not a poll with no one in it.
  it("carries polls that have not been released yet", () => {
    expect(getTeamRankingSummary(utahState)?.pending).toEqual([
      expect.objectContaining({ name: "AP Top 25", expectedLabel: "August 17" }),
    ]);
  });
});

describe("getRankingDocuments", () => {
  it("states an unranked team's standing without dressing it up", () => {
    const [document] = getRankingDocuments(utahState);

    expect(document.body).toContain("Utah State is not ranked");
    expect(document.body).toContain("No. 19 Washington");
    expect(document.provider).toBe("press");
    expect(document.sourceType).toBe("ranking");
  });

  it("carries a link to the poll it is quoting", () => {
    expect(getRankingDocuments(texas)[0].sourceUrl).toMatch(/^https:\/\//);
  });
});
