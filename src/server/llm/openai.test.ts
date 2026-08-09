// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("openai", () => {
  class APIError extends Error {}

  return {
    default: class {
      chat = { completions: { create } };
      static APIError = APIError;
    },
  };
});

const { baseModelId, createOpenAiProvider, defaultOpenAiModel } = await import("./openai");
const { estimateCostMicroUsd, isModelPriced } = await import("./pricing");

const request = { system: "system", messages: [{ role: "user" as const, content: "hi" }] };

function completion(overrides: Record<string, unknown> = {}) {
  return {
    model: "gpt-5.6-luna-2026-07-30",
    choices: [{ message: { content: "an answer" } }],
    usage: { prompt_tokens: 900, completion_tokens: 120 },
    ...overrides,
  };
}

beforeEach(() => {
  create.mockReset();
});

describe("openai provider", () => {
  // This is the regression that mattered: the client returned text and model
  // but no usage, so `answer.ts` — which ledgers only `if (result.usage)` —
  // silently recorded nothing. Health still reported live-metered while
  // month-to-date spend sat at zero forever.
  it("returns usage so the ledger records the call", async () => {
    create.mockResolvedValue(completion());

    const result = await createOpenAiProvider({ OPENAI_API_KEY: "sk-test" }).generate(request);

    expect(result.usage).toEqual({
      inputTokens: 900,
      outputTokens: 120,
      model: "gpt-5.6-luna-2026-07-30",
    });
  });

  // A zeroed row reads as a free call, which is wrong rather than absent.
  it("omits usage entirely when the provider sends none", async () => {
    create.mockResolvedValue(completion({ usage: undefined }));

    const result = await createOpenAiProvider({ OPENAI_API_KEY: "sk-test" }).generate(request);

    expect(result.usage).toBeUndefined();
  });

  it("defaults to Luna and caps output at a paragraph's worth of tokens", async () => {
    create.mockResolvedValue(completion());

    await createOpenAiProvider({ OPENAI_API_KEY: "sk-test" }).generate(request);

    const params = create.mock.calls[0][0];
    expect(params.model).toBe("gpt-5.6-luna");
    expect(defaultOpenAiModel).toBe("gpt-5.6-luna");
    expect(params.max_completion_tokens).toBe(1024);
  });

  // The work is already grounded by retrieval; effort here buys reasoning
  // tokens that move the bill more than the answer.
  it("asks for low reasoning effort on the 5.6 family", async () => {
    create.mockResolvedValue(completion());

    await createOpenAiProvider({ OPENAI_API_KEY: "sk-test" }).generate(request);

    expect(create.mock.calls[0][0].reasoning_effort).toBe("low");
  });

  // Older models reject the parameter, and a 400 on every call is worse than a
  // slightly slower answer.
  it("never sends reasoning effort to a model that rejects it", async () => {
    create.mockResolvedValue(completion({ model: "gpt-4o" }));

    await createOpenAiProvider({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o" }).generate(
      request,
    );

    expect(create.mock.calls[0][0]).not.toHaveProperty("reasoning_effort");
  });

  it("keeps the unchanging system prompt first so the provider cache can hit", async () => {
    create.mockResolvedValue(completion());

    await createOpenAiProvider({ OPENAI_API_KEY: "sk-test" }).generate(request);

    expect(create.mock.calls[0][0].messages[0]).toEqual({ role: "system", content: "system" });
  });

  it("asks the stream for usage, which is otherwise never sent", async () => {
    create.mockResolvedValue(
      (async function* () {
        yield { choices: [{ delta: { content: "hi" } }] };
      })(),
    );

    const provider = createOpenAiProvider({ OPENAI_API_KEY: "sk-test" });
    for await (const _ of provider.stream(request)) {
      void _;
    }

    expect(create.mock.calls[0][0].stream_options).toEqual({ include_usage: true });
  });
});

describe("pinned model ids", () => {
  it("strips a dated suffix back to the family alias", () => {
    expect(baseModelId("gpt-5.6-luna-2026-07-30")).toBe("gpt-5.6-luna");
    expect(baseModelId("gpt-5.6-luna")).toBe("gpt-5.6-luna");
  });

  // Costing runs off `response.model`, which is pinned. An alias-only table
  // threw on every live call when this happened with Anthropic.
  it("prices the pinned id the provider actually returns", () => {
    expect(isModelPriced("gpt-5.6-luna-2026-07-30")).toBe(true);

    // 900 in at $0.20/Mtok = 180 micro; 120 out at $1.20/Mtok = 144 micro.
    expect(
      estimateCostMicroUsd({
        inputTokens: 900,
        outputTokens: 120,
        model: "gpt-5.6-luna-2026-07-30",
      }),
    ).toBe(324);
  });

  // The narrow rule is the point: a different family must not inherit a
  // neighbour's price just because the string looks similar.
  it("still refuses to guess at an unrelated model", () => {
    expect(isModelPriced("gpt-6-something")).toBe(false);
  });
});
