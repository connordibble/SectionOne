// @vitest-environment node
import { describe, expect, it } from "vitest";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import type { SourceDocument } from "@/server/sources/types";
import { fuseByRrf, retrieveHybrid } from "./hybrid";
import type { RetrievalHit } from "./retrieve";
import type { SourceChunk } from "./chunk";

function hit(id: string): RetrievalHit {
  return {
    score: 1,
    chunk: { id, sourceDocumentId: id, chunkIndex: 0, content: id, tokenEstimate: 1 } as SourceChunk,
  };
}

function vectorHit(document: SourceDocument, score = 0.9): RetrievalHit {
  return {
    score,
    chunk: {
      id: `${document.id}-chunk-0`,
      sourceDocumentId: document.id,
      chunkIndex: 0,
      content: document.body,
      tokenEstimate: 8,
      document,
    },
  };
}

describe("fuseByRrf", () => {
  it("ranks a chunk appearing in both lists above singletons", () => {
    const lexical = [hit("a"), hit("b")];
    const vector = [hit("c"), hit("a")];

    const fused = fuseByRrf([lexical, vector], 3);

    // "a" appears in both rankings, so RRF sums put it first.
    expect(fused[0].chunk.id).toBe("a");
    expect(fused.map((entry) => entry.chunk.id)).toHaveLength(3);
  });

  it("dedupes by chunk id", () => {
    const fused = fuseByRrf([[hit("a")], [hit("a")]], 5);

    expect(fused).toHaveLength(1);
    expect(fused[0].chunk.id).toBe("a");
  });
});

describe("retrieveHybrid", () => {
  it("falls back to pure lexical retrieval when no database is configured", async () => {
    const ingest = await collectSourceDocuments("texas-football");

    // deps.db = null forces the vector path to no-op, mirroring an offline run.
    const hits = await retrieveHybrid(
      "Give me the next-game briefing.",
      ingest.documents,
      "texas-football",
      4,
      { db: null },
    );

    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].chunk.document.title).toBe("Texas football 2026 schedule");
  });

  it("returns nothing when neither lexical nor vector match", async () => {
    const ingest = await collectSourceDocuments("texas-football");

    const hits = await retrieveHybrid("zzz qqq xyzzy", ingest.documents, "texas-football", 4, {
      db: null,
    });

    expect(hits).toEqual([]);
  });

  it("excludes vector results that are no longer in the published corpus", async () => {
    const published: SourceDocument = {
      id: "weekly-current",
      teamSlug: "texas-football",
      provider: "press",
      sourceType: "news",
      sourceUrl: "https://example.com/current",
      title: "The current weekly report",
      body: "The published briefing carries this report.",
      metadata: {},
      publishedAt: "2026-08-27T12:00:00.000Z",
      fetchedAt: "2026-08-27T12:00:00.000Z",
    };
    const withdrawn: SourceDocument = {
      ...published,
      id: "weekly-withdrawn",
      sourceUrl: "https://example.com/withdrawn",
      title: "A superseded weekly report",
      body: "This report remains in the vector database but is no longer published.",
      publishedAt: "2026-08-09T12:00:00.000Z",
      fetchedAt: "2026-08-09T12:00:00.000Z",
    };

    const hits = await retrieveHybrid(
      "Which weekly report should I trust?",
      [published],
      "texas-football",
      4,
      {
        vectorSearch: async () => [vectorHit(withdrawn, 0.99), vectorHit(published, 0.8)],
      },
    );

    expect(hits.map((entry) => entry.chunk.document.id)).toContain(published.id);
    expect(hits.map((entry) => entry.chunk.document.id)).not.toContain(withdrawn.id);
  });
});
