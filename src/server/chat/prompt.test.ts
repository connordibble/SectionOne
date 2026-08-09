// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultTeamConfig } from "@/config/team";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { retrieveSourceChunks } from "@/server/rag/retrieve";
import { buildChatRequest, maxHistoryMessages, sanitizeHistory } from "./prompt";

async function retrieve(question: string) {
  const ingest = await collectSourceDocuments("texas-football");
  return retrieveSourceChunks(question, ingest.documents, 4);
}

describe("buildChatRequest", () => {
  it("builds a system prompt carrying the team voice contract and excerpts", async () => {
    const hits = await retrieve("Give me the next-game briefing.");
    const request = buildChatRequest(defaultTeamConfig, "Give me the next-game briefing.", hits);

    expect(request.system).toContain("Texas football");
    expect(request.system).toContain("early downs");
    expect(request.system).toMatch(/not affiliated/i);
    expect(request.system).toContain("Source excerpts:");
    expect(request.system).toContain("[1]");
    expect(request.messages.at(-1)).toEqual({
      role: "user",
      content: "Give me the next-game briefing.",
    });
  });

  // Classification itself now lives in routing.ts; this only asserts that the
  // facts each capability needs are gathered and that the chosen capability is
  // passed straight through.
  it("gathers the facts every composer capability needs", async () => {
    const hits = await retrieve("Give me the next-game briefing.");
    const request = buildChatRequest(
      defaultTeamConfig,
      "Give me the next-game briefing.",
      hits,
      [],
      "next-game-brief",
    );

    expect(request.grounding?.capability).toBe("next-game-brief");
    expect(request.grounding?.nextGame?.opponent).toBe("Texas State");
    expect(request.grounding?.upcomingGames.length).toBeGreaterThan(0);
    expect(request.grounding?.sourceReadiness.length).toBeGreaterThan(0);
    expect(request.grounding?.scheduleCapturedAt).toBeTruthy();
    expect(request.grounding?.citationTitles.length).toBeGreaterThan(0);
  });

  it("puts the relevant team note first for a team-note brief", async () => {
    const hits = await retrieve("How does Ohio State look?");
    const request = buildChatRequest(
      defaultTeamConfig,
      "How does Ohio State look?",
      hits,
      [],
      "team-note-brief",
    );

    expect(request.grounding?.excerpts[0]?.title).toBe("Ohio State: the first big test");

    const earlyDownHits = await retrieve("What matters on early downs?");
    const earlyDownRequest = buildChatRequest(
      defaultTeamConfig,
      "What matters on early downs?",
      earlyDownHits,
      [],
      "team-note-brief",
    );

    expect(earlyDownRequest.grounding?.excerpts[0]?.title).toBe(
      "Early downs: stay on schedule",
    );
  });

  it("leaves capability undefined for escalated questions", async () => {
    const hits = await retrieve("How does the offensive line look?");
    const request = buildChatRequest(
      defaultTeamConfig,
      "How does the offensive line look?",
      hits,
    );

    expect(request.grounding?.capability).toBeUndefined();
  });
});

describe("sanitizeHistory", () => {
  it("caps history and strips empty messages", () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: (index % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `message ${index}`,
    }));

    const sanitized = sanitizeHistory([
      { role: "user", content: "   " },
      ...history,
    ]);

    expect(sanitized).toHaveLength(maxHistoryMessages);
    expect(sanitized.at(-1)?.content).toBe("message 11");
  });

  it("truncates oversized messages", () => {
    const sanitized = sanitizeHistory([{ role: "user", content: "x".repeat(10_000) }]);

    expect(sanitized[0].content.length).toBeLessThanOrEqual(4000);
  });
});
