import Anthropic from "@anthropic-ai/sdk";
import {
  LlmProviderError,
  type LlmEnv,
  type LlmProvider,
  type LlmRequest,
  type LlmUsage,
} from "./types";

export const defaultAnthropicModel = "claude-haiku-4-5";

// Saturday Signal answers are one grounded paragraph. A tight ceiling bounds
// the worst case if a model ever runs away, and costs nothing in the normal
// case because billing is on tokens generated, not on the cap.
const defaultMaxTokens = 1024;

type ThinkingBehavior = {
  // Whether the model accepts the 4.6+ `thinking: {type: ...}` shape at all.
  // Haiku 4.5 and older models return 400 for it.
  acceptsThinkingParam: boolean;
  // Whether omitting `thinking` still runs (and bills) thinking. True on
  // Opus 5, where thinking is on by default — there it must be disabled
  // explicitly rather than by omission.
  thinkingOnByDefault: boolean;
};

// Conservative default for anything unlisted: send no thinking parameter. That
// can never 400, and the only cost of being wrong is a model that thinks when
// we would rather it did not.
const conservativeBehavior: ThinkingBehavior = {
  acceptsThinkingParam: false,
  thinkingOnByDefault: false,
};

const modelBehavior: Record<string, ThinkingBehavior> = {
  "claude-haiku-4-5": { acceptsThinkingParam: false, thinkingOnByDefault: false },
  "claude-haiku-4-5-20251001": { acceptsThinkingParam: false, thinkingOnByDefault: false },
  "claude-opus-4-8": { acceptsThinkingParam: true, thinkingOnByDefault: false },
  "claude-sonnet-5": { acceptsThinkingParam: true, thinkingOnByDefault: true },
  "claude-opus-5": { acceptsThinkingParam: true, thinkingOnByDefault: true },
};

export function createAnthropicProvider(env: LlmEnv = process.env): LlmProvider {
  const apiKey = env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new LlmProviderError("anthropic", "ANTHROPIC_API_KEY is not configured.");
  }

  const model = env.ANTHROPIC_MODEL || defaultAnthropicModel;
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    model,

    async generate(request: LlmRequest) {
      try {
        const response = await client.messages.create(buildParams(model, request));

        if (response.stop_reason === "refusal") {
          throw new LlmProviderError("anthropic", "The model declined to answer this request.");
        }

        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("");

        return {
          text,
          model: response.model,
          usage: toUsage(response.model, response.usage),
        };
      } catch (error) {
        throw wrapError(error);
      }
    },

    // Retained for interface compatibility and future true-streaming work. The
    // chat orchestrator no longer streams live providers directly: it buffers a
    // full answer so the voice and citation gate can reject it before any text
    // reaches the browser.
    async *stream(request: LlmRequest) {
      try {
        const stream = client.messages.stream(buildParams(model, request));

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield event.delta.text;
          }
        }

        const final = await stream.finalMessage();

        if (final.stop_reason === "refusal") {
          throw new LlmProviderError("anthropic", "The model declined to answer this request.");
        }
      } catch (error) {
        throw wrapError(error);
      }
    },
  };
}

function toUsage(model: string, usage: Anthropic.Usage): LlmUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    model,
  };
}

// Thinking configuration is model-family specific, so this cannot be a single
// static object. `thinking: {type: "adaptive"}` is a 4.6+ shape and returns 400
// on Haiku 4.5; conversely, omitting `thinking` on Opus 5 leaves adaptive
// thinking on and bills for it. Neither is what this workload wants.
function buildParams(
  model: string,
  request: LlmRequest,
): Anthropic.MessageCreateParamsNonStreaming {
  const behavior = modelBehavior[model] ?? conservativeBehavior;
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: request.maxTokens ?? defaultMaxTokens,
    system: request.system,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  };

  // Only send the parameter where it is both accepted and load-bearing.
  if (behavior.acceptsThinkingParam && behavior.thinkingOnByDefault) {
    params.thinking = { type: "disabled" };
  }

  return params;
}

function wrapError(error: unknown): LlmProviderError {
  if (error instanceof LlmProviderError) {
    return error;
  }

  if (error instanceof Anthropic.APIError) {
    return new LlmProviderError("anthropic", `API error ${error.status}: ${error.message}`, {
      cause: error,
    });
  }

  return new LlmProviderError("anthropic", "Request failed.", { cause: error });
}
