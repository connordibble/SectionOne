// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "./anthropic";
import { LlmProviderError, type LlmRequest } from "./types";

const request: LlmRequest = {
  system: "You are a test analyst.",
  messages: [{ role: "user", content: "next game?" }],
};

function messageJson(text: string) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function sseBody(deltas: string[]) {
  const events = [
    `event: message_start\ndata: ${JSON.stringify({
      type: "message_start",
      message: { ...messageJson(""), content: [], stop_reason: null },
    })}\n\n`,
    `event: content_block_start\ndata: ${JSON.stringify({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    })}\n\n`,
    ...deltas.map(
      (text) =>
        `event: content_block_delta\ndata: ${JSON.stringify({
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text },
        })}\n\n`,
    ),
    `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 5 },
    })}\n\n`,
    `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
  ];

  return events.join("");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("anthropic provider", () => {
  it("requires an API key", () => {
    expect(() => createAnthropicProvider({})).toThrow(LlmProviderError);
  });

  it("sends the Messages API shape and parses text blocks", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(messageJson("Grounded answer.")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnthropicProvider({ ANTHROPIC_API_KEY: "sk-test" });
    const result = await provider.generate(request);

    expect(result.text).toBe("Grounded answer.");
    expect(result.model).toBe("claude-haiku-4-5-20251001");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string | URL,
      { headers: Headers | Record<string, string>; body: string },
    ];
    expect(String(url)).toContain("/v1/messages");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.system).toBe(request.system);
    // Haiku 4.5 predates the adaptive-thinking shape and 400s on it, so the
    // parameter must be absent rather than set to any value.
    expect(body.thinking).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: "next game?" }]);
  });

  it("honors ANTHROPIC_MODEL overrides", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(messageJson("ok")), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnthropicProvider({
      ANTHROPIC_API_KEY: "sk-test",
      ANTHROPIC_MODEL: "claude-opus-4-8",
    });
    await provider.generate(request);

    const [, init] = fetchMock.mock.calls[0] as unknown as [unknown, { body: string }];
    expect((JSON.parse(init.body) as { model: string }).model).toBe("claude-opus-4-8");
  });

  it("streams text deltas from SSE events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(sseBody(["Texas ", "wins ", "early downs."]), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const provider = createAnthropicProvider({ ANTHROPIC_API_KEY: "sk-test" });
    let streamed = "";
    for await (const delta of provider.stream(request)) {
      streamed += delta;
    }

    expect(streamed).toBe("Texas wins early downs.");
  });

  it("wraps API failures in LlmProviderError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const provider = createAnthropicProvider({ ANTHROPIC_API_KEY: "sk-test" });
    await expect(provider.generate(request)).rejects.toThrow(LlmProviderError);
  });
});
