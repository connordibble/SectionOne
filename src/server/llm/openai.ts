import OpenAI from "openai";
import {
  LlmProviderError,
  type LlmEnv,
  type LlmProvider,
  type LlmRequest,
  type LlmUsage,
} from "./types";

export const defaultOpenAiModel = "gpt-5.6-luna";

// The prompt asks for one tight paragraph. The previous 16000 was the same
// latent cost bug already fixed on the Anthropic client: a ceiling that high
// does not make answers better, it just removes the guardrail if the model
// ever runs away.
const defaultMaxTokens = 1024;

type ModelBehavior = {
  // The 5.6 family exposes reasoning effort. Older models reject the
  // parameter outright, so it is opt-in per model rather than always sent.
  acceptsReasoningEffort: boolean;
};

const modelBehavior: Record<string, ModelBehavior> = {
  "gpt-5.6-luna": { acceptsReasoningEffort: true },
  "gpt-5.6-terra": { acceptsReasoningEffort: true },
  "gpt-5.6-sol": { acceptsReasoningEffort: true },
  "gpt-4o": { acceptsReasoningEffort: false },
};

// Conservative default for an unknown model: send nothing optional. A rejected
// parameter is a 400 on every call, which is worse than a slightly slower answer.
const fallbackBehavior: ModelBehavior = { acceptsReasoningEffort: false };

function behaviorFor(model: string): ModelBehavior {
  return modelBehavior[baseModelId(model)] ?? fallbackBehavior;
}

// Responses come back with a pinned id (`gpt-5.6-luna-2026-07-30`) while the
// request goes out with the alias. Strip a trailing ISO date so both resolve
// to the same behaviour and the same price.
export function baseModelId(model: string): string {
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export function createOpenAiProvider(env: LlmEnv = process.env): LlmProvider {
  const apiKey = env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new LlmProviderError("openai", "OPENAI_API_KEY is not configured.");
  }

  const model = env.OPENAI_MODEL || defaultOpenAiModel;
  const client = new OpenAI({ apiKey });

  return {
    name: "openai",
    model,

    async generate(request: LlmRequest) {
      try {
        const response = await client.chat.completions.create(buildParams(model, request));

        return {
          text: response.choices[0]?.message?.content ?? "",
          model: response.model,
          usage: toUsage(response.model, response.usage),
        };
      } catch (error) {
        throw wrapError(error);
      }
    },

    async *stream(request: LlmRequest) {
      try {
        const stream = await client.chat.completions.create({
          ...buildParams(model, request),
          stream: true,
          // Without this the final chunk carries no usage and the exchange is
          // invisible to the ledger.
          stream_options: { include_usage: true },
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;

          if (delta) {
            yield delta;
          }
        }
      } catch (error) {
        throw wrapError(error);
      }
    },
  };
}

function buildParams(
  model: string,
  request: LlmRequest,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model,
    max_completion_tokens: request.maxTokens ?? defaultMaxTokens,
    messages: buildMessages(request),
  };

  if (behaviorFor(model).acceptsReasoningEffort) {
    // The hard thinking already happened: retrieval selected the excerpts and
    // the composer handles anything templatable. What reaches a provider is a
    // short grounded write-up, and higher effort would buy reasoning tokens
    // that change the bill more than the answer.
    params.reasoning_effort = "low";
  }

  return params;
}

// Returns undefined rather than zeros when the provider sends no usage block.
// A zeroed row would read as a free call in the ledger, which is worse than a
// missing one — it is wrong rather than absent.
function toUsage(model: string, usage: OpenAI.CompletionUsage | undefined): LlmUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    model,
  };
}

function buildMessages(
  request: LlmRequest,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    // System first and unchanging across a session: the voice contract and
    // source policy are identical every call, so keeping them at the front is
    // what makes the provider's prompt cache hit. Cached input bills at a
    // tenth of standard, and moving anything variable above this would throw
    // that away.
    { role: "system", content: request.system },
    ...request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function wrapError(error: unknown): LlmProviderError {
  if (error instanceof LlmProviderError) {
    return error;
  }

  if (error instanceof OpenAI.APIError) {
    return new LlmProviderError("openai", `API error ${error.status}: ${error.message}`, {
      cause: error,
    });
  }

  return new LlmProviderError("openai", "Request failed.", { cause: error });
}
