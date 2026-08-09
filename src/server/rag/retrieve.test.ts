// @vitest-environment node
import { describe, expect, it } from "vitest";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { retrieveSourceChunks } from "./retrieve";

async function topTitles(question: string, limit = 4) {
  const ingest = await collectSourceDocuments("texas-football");
  return retrieveSourceChunks(question, ingest.documents, limit).map(
    (hit) => hit.chunk.document.title,
  );
}

describe("retrieveSourceChunks", () => {
  it("ranks the Ohio State documents above Texas State for Ohio State questions", async () => {
    const titles = await topTitles("How does Ohio State look?");

    expect(titles[0]).toMatch(/Ohio State/);
    expect(titles.join(" ")).not.toMatch(/vs Texas State.*vs Texas State/);
  });

  it("ranks the schedule summary first for next-game questions", async () => {
    const titles = await topTitles("Give me the next-game briefing.");

    expect(titles[0]).toBe("Texas football 2026 schedule");
  });

  it("surfaces the roster note for roster questions", async () => {
    const titles = await topTitles("Where is the roster context still thin?");

    expect(titles[0]).toBe("Interior line: find the best five");
  });

  it("surfaces the early-downs note for early-down questions", async () => {
    const titles = await topTitles("What should Texas fans watch on early downs?");

    expect(titles).toContain("Early downs: stay on schedule");
  });

  it("returns nothing for questions with no matching terms", async () => {
    const ingest = await collectSourceDocuments("texas-football");
    const hits = retrieveSourceChunks("zzz qqq xyzzy", ingest.documents, 4);

    expect(hits).toEqual([]);
  });
});
