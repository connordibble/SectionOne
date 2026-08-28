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
    expect(result.mode).toBe("grounded");
    expect(result.provider).toBe("mock");
    expect(evaluateVoiceSample(result.answer).passed).toBe(true);
  });

  it("caveats rumor and injury questions without calling any provider", async () => {
    const result = await answerQuestion("I heard a message board injury rumor. Is it true?");

    expect(result.mode).toBe("guardrail");
    expect(result.answer).toContain("That is not confirmed");
    expect(result.answer).toContain("will not repeat injury");
  });

  it("does not mistake ordinary football language for a betting claim", async () => {
    for (const question of [
      "How can Texas be better on offense?",
      "What should Texas lock in before kickoff?",
      "How does Texas lock down early downs?",
    ]) {
      const result = await answerQuestion(question);

      expect(result.mode, question).not.toBe("guardrail");
      expect(result.answer, question).not.toContain("That is not confirmed");
    }
  });

  it("does not answer a named-subject question from unrelated evidence", async () => {
    const result = await answerQuestion("What happened to TyAnthony Smith?");

    expect(result.mode).toBe("no-context");
    expect(result.provider).toBe("policy");
    expect(result.answer).toContain("not a verified report on TyAnthony Smith");
    expect(result.citations).toEqual([]);
  });

  it("uses one approved-domain web search after local evidence misses a named subject", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body));

      expect(request.max_tool_calls).toBe(1);
      expect(request.tools[0].filters.allowed_domains).toContain("texaslonghorns.com");

      return new Response(
        JSON.stringify({
          id: "resp_test",
          object: "response",
          created_at: 1,
          status: "completed",
          model: "gpt-5.6-luna-2026-07-30",
          output_text:
            "TyAnthony Smith was dismissed from the football program in a personnel decision. 【1†source】",
          output: [
            {
              id: "msg_test",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: "TyAnthony Smith was dismissed from the football program in a personnel decision. 【1†source】",
                  annotations: [
                    {
                      type: "url_citation",
                      title: "Texas announces roster change",
                      url: "https://texaslonghorns.com/news/roster-change",
                      start_index: 82,
                      end_index: 92,
                    },
                  ],
                },
              ],
            },
          ],
          usage: {
            input_tokens: 30,
            output_tokens: 20,
            total_tokens: 50,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerQuestion("What happened to TyAnthony Smith?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("grounded");
    expect(result.provider).toBe("openai-web-search");
    expect(result.answer).toContain("[Texas announces roster change]");
    expect(result.citations).toHaveLength(1);
    expect(result.freshness.search).toContain("Live reporting checked");
  });

  it("keeps the no-context refusal when searched citations are outside the approved domains", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model: "gpt-5.6-luna-2026-07-30",
          output_text: "A copied recap says he left the football program.",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "A copied recap says he left the football program.",
                  annotations: [
                    {
                      type: "url_citation",
                      title: "Copied recap",
                      url: "https://example.com/recap",
                      start_index: 0,
                      end_index: 6,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerQuestion("What happened to TyAnthony Smith?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe("no-context");
    expect(result.provider).toBe("policy");
    expect(result.citations).toEqual([]);
  });

  it("keeps a named-subject question on the answer path when the evidence names it", async () => {
    const result = await answerQuestion("What happened with Texas State?");

    expect(result.mode).toBe("grounded");
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it("does not search when local evidence already names the subject", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const requestedUrls: string[] = [];
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      requestedUrls.push(String(input));
      return new Response(JSON.stringify({ error: { message: "normal provider unavailable" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await answerQuestion("What happened with Texas State?");

    expect(result.mode).toBe("grounded");
    expect(result.provider).toBe("mock");
    expect(requestedUrls.some((url) => url.endsWith("/v1/responses"))).toBe(false);
  });

  it("reports editorial and schedule freshness separately", async () => {
    const result = await answerQuestion("Give me the next-game briefing.");

    expect(result.freshness).toEqual({
      coverage: "Coverage updated August 27, 2026.",
      schedule: "Schedule updated July 1, 2026.",
      context: "No 2026 stats yet.",
    });
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
    expect(result.notice).toContain("live answer service was unavailable");
    // Operational messages stay out of freshness, which describes the corpus.
    expect(Object.values(result.freshness).join(" ")).not.toContain("anthropic");
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
