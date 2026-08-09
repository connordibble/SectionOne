// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateVoiceSample } from "@/lib/content/voice";
import { answerQuestion, streamAnswerEvents } from "./answer";
import type { ChatStreamEvent } from "./types";

function anthropicMessage(text: string) {
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

// SSE fixtures were removed along with the mid-stream fallback path: the
// orchestrator no longer streams live providers, it buffers a full answer so
// the acceptance gate can reject it before any text reaches the browser.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// Routing serves next-game, schedule, source-readiness and team-note questions
// from the deterministic composer, so those never reach a provider. Exercising
// the live path needs a question that genuinely escalates — this one is also
// the case a bare /next/ classifier used to mis-route into a canned briefing.
const escalatingQuestion = "What should the offense fix before the next game?";

describe("answerQuestion", () => {
  it("answers next-game questions with citations and football language", async () => {
    const result = await answerQuestion("Give me the next-game briefing.");

    expect(result.answer).toContain("Texas State");
    expect(result.answer).toContain("early downs");
    expect(result.citations.length).toBeGreaterThanOrEqual(2);
    expect(result.confidence).toBe("high");
    expect(result.mode).toBe("grounded");
    expect(result.provider).toBe("mock");
    expect(evaluateVoiceSample(result.answer).passed).toBe(true);
  });

  it("caveats rumor and injury questions without calling any provider", async () => {
    const result = await answerQuestion("I heard a message board injury rumor. Is it true?");

    expect(result.confidence).toBe("low");
    expect(result.mode).toBe("guardrail");
    expect(result.answer).toContain("That is not confirmed");
    expect(result.answer).toContain("will not repeat injury");
  });

  it("falls back to the deterministic composer when the live provider fails", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-broken");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ type: "error", error: { type: "api_error", message: "down" } }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await answerQuestion(escalatingQuestion);

    expect(result.provider).toBe("mock");
    expect(result.confidence).toBe("low");
    expect(result.notice).toContain("live answer service was unavailable");
    // Operational messages stay out of freshness, which describes the corpus.
    expect(result.freshness).not.toContain("anthropic");
  }, 30_000);

  it("falls back to the deterministic composer when the live provider returns an empty answer", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-empty");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(anthropicMessage("   ")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const result = await answerQuestion(escalatingQuestion);

    expect(result.provider).toBe("mock");
    expect(result.confidence).toBe("low");
    expect(result.notice).toContain("verified local read");
  }, 30_000);

  it("never lets a fabricated citation reach the caller", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-liar");

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify(
          anthropicMessage(
            "Texas wins on early downs and field position. [Definitely Real Source]",
          ),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerQuestion(escalatingQuestion);

    // The answer reads perfectly well and carries football vocabulary, so only
    // the citation check can catch it. Without that check this ships.
    expect(result.answer).not.toContain("Definitely Real Source");
    expect(result.provider).toBe("mock");
    expect(result.notice).toContain("sourcing gate");
    // One retry with the failure named, then the composer — two billed calls.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 30_000);

  it("rejects unknown teams", async () => {
    await expect(answerQuestion("hello", "nope-football")).rejects.toThrow("Unknown team slug");
  });
});

describe("streamAnswerEvents", () => {
  async function collect(question: string) {
    const events: ChatStreamEvent[] = [];

    for await (const event of streamAnswerEvents(question)) {
      events.push(event);
    }

    return events;
  }

  it("streams citations first, then deltas that assemble the final answer", async () => {
    const events = await collect("Give me the next-game briefing.");

    expect(events[0].type).toBe("citations");
    const deltas = events.filter((event) => event.type === "delta");
    const done = events.at(-1);

    expect(deltas.length).toBeGreaterThan(1);
    if (done?.type !== "done") {
      throw new Error("expected a done event");
    }
    expect(deltas.map((delta) => delta.text).join("")).toBe(done.answer.answer);
    expect(done.answer.citations.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to the composer when the live provider returns no answer text", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-empty");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(anthropicMessage("   ")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const events = await collect(escalatingQuestion);
    const done = events.at(-1);

    if (done?.type !== "done") {
      throw new Error("expected a done event");
    }
    expect(done.answer.provider).toBe("mock");
    expect(done.answer.confidence).toBe("low");
    expect(done.answer.notice).toContain("verified local read");
    expect(events.filter((event) => event.type === "delta")).not.toHaveLength(0);
  }, 30_000);

  it("emits no delta until the answer has passed the acceptance gate", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-liar");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify(
            anthropicMessage(
              "Texas wins on early downs and field position. [Definitely Real Source]",
            ),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const events = await collect(escalatingQuestion);
    const streamed = events
      .filter((event) => event.type === "delta")
      .map((event) => event.text)
      .join("");

    // The whole reason the orchestrator buffers instead of streaming the
    // provider: a rejected answer must never reach the browser, and once a
    // delta is on the wire no retry can take it back.
    expect(streamed).not.toContain("Definitely Real Source");
    expect(events.at(-1)?.type).toBe("done");
  }, 30_000);

  it("streams guardrail answers as a single delta", async () => {
    const events = await collect("Any betting locks this week?");
    const done = events.at(-1);

    if (done?.type !== "done") {
      throw new Error("expected a done event");
    }
    expect(done.answer.mode).toBe("guardrail");
    expect(events.filter((event) => event.type === "delta")).toHaveLength(1);
  });
});
