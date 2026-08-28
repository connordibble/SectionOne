// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { createDbClient } from "@/server/db/client";
import type { ChatAnswer } from "./types";
import { isUuid, persistChatExchange } from "./persistence";

type Db = ReturnType<typeof createDbClient>["db"];

const fakeSessionId = "11111111-1111-4111-8111-111111111111";

const answer: ChatAnswer = {
  teamSlug: "texas-football",
  answer: "Texas opens vs Texas State. [Texas football 2026 schedule]",
  citations: [
    {
      id: "texas-football-2026-schedule",
      title: "Texas football 2026 schedule",
      sourceUrl: "https://example.com",
      provider: "fixture",
      sourceType: "schedule",
    },
  ],
  freshness: {
    coverage: "Coverage updated August 27, 2026.",
    schedule: "Schedule updated July 1, 2026.",
  },
  mode: "grounded",
  provider: "mock",
  model: "deterministic-composer",
};

function fakeDb(inserted: unknown[][]) {
  return {
    insert() {
      return {
        values(values: unknown) {
          inserted.push(Array.isArray(values) ? values : [values]);
          return {
            returning: async () => [{ id: fakeSessionId }],
            then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(undefined).then(resolve, reject),
          };
        },
      };
    },
  } as unknown as Db;
}

describe("persistChatExchange", () => {
  it("is a no-op without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");

    const result = await persistChatExchange({ question: "q", answer });

    expect(result).toBeNull();
    vi.unstubAllEnvs();
  });

  it("creates a session and stores both turns plus citations", async () => {
    const inserted: unknown[][] = [];

    const result = await persistChatExchange({ question: "next game?", answer }, fakeDb(inserted));

    expect(result).toEqual({ sessionId: fakeSessionId });
    // session row, message pair, citation rows
    expect(inserted).toHaveLength(3);
    expect(inserted[1]).toMatchObject([
      { role: "user", content: "next game?" },
      { role: "assistant", provider: "mock" },
    ]);
    expect(inserted[2]).toMatchObject([
      { sourceDocumentId: "texas-football-2026-schedule" },
    ]);
  });

  it("reuses a provided session id", async () => {
    const inserted: unknown[][] = [];
    const providedId = "22222222-2222-4222-8222-222222222222";

    const result = await persistChatExchange(
      { question: "q", answer, sessionId: providedId },
      fakeDb(inserted),
    );

    expect(result).toEqual({ sessionId: providedId });
    // no session insert, just messages + citations
    expect(inserted).toHaveLength(2);
  });

  it("swallows database failures", async () => {
    const throwingDb = {
      insert() {
        throw new Error("connection refused");
      },
    } as unknown as Db;

    const result = await persistChatExchange({ question: "q", answer }, throwingDb);

    expect(result).toBeNull();
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects everything else", () => {
    expect(isUuid(fakeSessionId)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("11111111111111111111111111111111")).toBe(false);
  });
});
