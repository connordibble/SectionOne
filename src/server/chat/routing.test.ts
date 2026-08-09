// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultTeamConfig, teamConfigs, enabledTeamSlugs } from "@/config/team";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { retrieveSourceChunks } from "@/server/rag/retrieve";
import { selectAnswerStrategy } from "./routing";

async function route(question: string, teamSlug = defaultTeamConfig.slug) {
  const team = teamConfigs[teamSlug as keyof typeof teamConfigs];
  const ingest = await collectSourceDocuments(teamSlug);
  const hits = retrieveSourceChunks(question, ingest.documents, 4);

  return selectAnswerStrategy(team, question, hits);
}

describe("selectAnswerStrategy", () => {
  it("serves an explicit next-game briefing from the composer", async () => {
    expect(await route("Give me the next-game briefing.")).toEqual({
      strategy: "composer",
      capability: "next-game-brief",
    });
  });

  // The classifier this replaced matched a bare /next/, so this question was
  // answered with a canned schedule recital instead of the analysis it asks
  // for. Mentioning the next game is not the same as asking about it.
  it("escalates analysis questions that merely mention the next game", async () => {
    expect(await route("What should the offense fix before the next game?")).toEqual({
      strategy: "escalate",
    });
  });

  it("serves schedule and source-readiness questions from the composer", async () => {
    expect(await route("Show me the schedule.")).toEqual({
      strategy: "composer",
      capability: "schedule",
    });
    expect(await route("What sources do you have?")).toEqual({
      strategy: "composer",
      capability: "source-readiness",
    });
  });

  it("serves a relevant curated note even when a schedule fact ranks first", async () => {
    expect(await route("How does Ohio State look?")).toEqual({
      strategy: "composer",
      capability: "team-note-brief",
    });

    expect(await route("Where is the roster context still thin?")).toEqual({
      strategy: "composer",
      capability: "team-note-brief",
    });
  });

  // One note cannot answer a question that weighs two things against each
  // other, however well that note scores in retrieval.
  it("escalates comparisons even when a note ranks first", async () => {
    expect(await route("Compare the Ohio State and Oklahoma matchups.")).toEqual({
      strategy: "escalate",
    });
  });

  it("escalates open-ended tactical questions", async () => {
    expect(await route("How should Texas attack a two-high safety look?")).toEqual({
      strategy: "escalate",
    });
  });

  // Guards the "composer-first" claim against drift: the UI promotes these
  // prompts, so if one of them silently starts escalating, the product is
  // paying for its own front page.
  it.each(enabledTeamSlugs)("serves every promoted prompt for %s from the composer", async (slug) => {
    const team = teamConfigs[slug];

    for (const prompt of team.suggestedPrompts) {
      const strategy = await route(prompt, slug);

      expect(strategy, `suggested prompt escalated: "${prompt}"`).toMatchObject({
        strategy: "composer",
      });
    }
  });
});
