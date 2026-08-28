import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { resolveChatRateLimit } from "@/server/http/rate-limit";

function chatRequest(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  it("rejects an empty message with 400", async () => {
    const response = await POST(chatRequest({ message: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "message is required" });
  });

  it("rejects an unknown team slug with 404 instead of throwing", async () => {
    const response = await POST(
      chatRequest({ message: "next-game brief", teamSlug: "nope-football" }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Unknown team slug: nope-football",
    });
  });

  it("rejects an oversized message with 400", async () => {
    const response = await POST(chatRequest({ message: "x".repeat(4001) }));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("at most");
  });

  it("rejects a malformed sessionId with 400", async () => {
    const response = await POST(chatRequest({ message: "next game", sessionId: "abc" }));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("sessionId");
  });

  it("rejects malformed history with 400", async () => {
    const response = await POST(
      chatRequest({ message: "next game", history: [{ role: "system", content: "x" }] }),
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toContain("history");
  });

  it("answers a valid request with grounded citations", async () => {
    const response = await POST(
      chatRequest({ message: "Give me the next-game briefing.", teamSlug: "texas-football" }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      answer: string;
      citations: unknown[];
      provider: string;
    };
    expect(body.answer).toContain("Texas State");
    expect(body.citations.length).toBeGreaterThanOrEqual(2);
    // Which model wrote the answer is not published. It is an implementation
    // detail, and naming it commits us to a disclosure we would have to keep
    // current every time it changes.
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("model");
  });

  it("streams citations, deltas, and a done event over SSE", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: "Give me the next-game briefing." }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const body = await response.text();
    expect(body).toContain("event: citations");
    expect(body).toContain("event: delta");
    expect(body).toContain("event: done");
  });
});

// The end-to-end suite raises this so a dozen browsers sharing 127.0.0.1 do not
// spend one visitor's allowance, which means the shipped number is asserted
// here or nowhere.
describe("chat rate limit", () => {
  it("ships at ten a minute", () => {
    expect(resolveChatRateLimit({})).toEqual({ name: "chat", windowMs: 60_000, max: 10 });
  });

  it("takes an override and ignores a nonsensical one", () => {
    expect(resolveChatRateLimit({ CHAT_RATE_LIMIT_PER_MINUTE: "500" }).max).toBe(500);

    for (const value of ["0", "-5", "abc", "2.5", ""]) {
      expect(resolveChatRateLimit({ CHAT_RATE_LIMIT_PER_MINUTE: value }).max, value).toBe(10);
    }
  });
});
