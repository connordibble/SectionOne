import { defaultTeamConfig, getTeamConfig, type TeamConfig } from "@/config/team";
import { evaluateVoiceSample } from "@/lib/content/voice";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { chunkText, createMockLlmProvider } from "@/server/llm/mock";
import { resolveLlmProvider } from "@/server/llm/registry";
import type { ComposerCapability, LlmEnv, LlmProvider, LlmRequest } from "@/server/llm/types";
import { recordLlmUsage } from "@/server/llm/usage";
import { retrieveHybrid } from "@/server/rag/hybrid";
import { formatCaptureDate, getTeamSchedule } from "@/server/schedule/schedule";
import { buildChatRequest, buildRetryDirective, type ChatHistoryMessage } from "./prompt";
import { selectAnswerStrategy } from "./routing";
import type { ChatAnswer, ChatCitation, ChatStreamEvent } from "./types";

const rumorPattern = /rumou?r|message board|heard|leak|injur|out for season|bet|lock/i;

export type AnswerOptions = {
  history?: ChatHistoryMessage[];
  env?: LlmEnv;
};

export async function answerQuestion(
  question: string,
  teamSlug = defaultTeamConfig.slug,
  options: AnswerOptions = {},
): Promise<ChatAnswer> {
  const prepared = await prepareAnswer(question, teamSlug, options);

  if (prepared.kind === "static") {
    return prepared.answer;
  }

  return produceAnswer(prepared, options.env);
}

export async function* streamAnswerEvents(
  question: string,
  teamSlug = defaultTeamConfig.slug,
  options: AnswerOptions = {},
): AsyncGenerator<ChatStreamEvent, void, void> {
  const prepared = await prepareAnswer(question, teamSlug, options);

  if (prepared.kind === "static") {
    yield { type: "citations", citations: prepared.answer.citations };
    yield { type: "delta", text: prepared.answer.answer };
    yield { type: "done", answer: prepared.answer };
    return;
  }

  yield { type: "citations", citations: prepared.citations };

  // Deliberately not streamed from the provider. The acceptance gate can reject
  // an answer for off-tone language or a fabricated citation, and once a delta
  // is on the wire that rejection is unenforceable — a retry cannot un-send
  // text the browser already rendered. So: generate fully, validate, then chunk
  // the accepted text. At ~300 output tokens the latency cost is small and the
  // quality guarantee becomes real rather than advisory.
  const answer = await produceAnswer(prepared, options.env);

  for (const chunk of chunkText(answer.answer)) {
    yield { type: "delta", text: chunk };
  }

  yield { type: "done", answer };
}

// Runs the composer or the live provider, applies the acceptance gate, and
// records every billable call.
async function produceAnswer(
  prepared: PreparedGeneration,
  env?: LlmEnv,
): Promise<ChatAnswer> {
  const composer = createMockLlmProvider();

  if (prepared.strategy === "composer") {
    const result = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, result.model, result.text);
  }

  const resolved = resolveLlmProvider(env ?? process.env);
  const provider = resolved.provider;

  // No live provider configured: the composer is the whole product, not a
  // degraded mode. Nothing to warn about.
  if (provider.name === composer.name) {
    const result = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, result.model, result.text);
  }

  const attempt = await generateAccepted(prepared, provider);

  if (attempt.accepted) {
    return finalizeAnswer(prepared, provider.name, attempt.model, attempt.text);
  }

  const fallback = await composer.generate(prepared.request);

  return finalizeAnswer(
    prepared,
    composer.name,
    fallback.model,
    fallback.text,
    attempt.notice,
  );
}

type AcceptedAttempt =
  | { accepted: true; text: string; model: string }
  | { accepted: false; notice: string };

// Generate, validate, retry once with the failures named, then give up. Every
// generation that reaches the provider is recorded, including the rejected
// ones — a retry is two billed calls, and a ledger that only counts accepted
// answers under-reports by exactly the expensive path.
async function generateAccepted(
  prepared: PreparedGeneration,
  provider: LlmProvider,
): Promise<AcceptedAttempt> {
  let request = prepared.request;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result;

    try {
      result = await provider.generate(request);
    } catch {
      return {
        accepted: false,
        notice:
          "The live answer service was unavailable. Saturday Signal used its verified local read instead.",
      };
    }

    const evaluation = evaluateAnswer(prepared, result.text);

    if (result.usage) {
      await recordLlmUsage({
        teamSlug: prepared.team.slug,
        provider: provider.name,
        usage: result.usage,
        accepted: evaluation.passed,
      });
    }

    if (evaluation.passed) {
      return { accepted: true, text: result.text, model: result.model };
    }

    request = {
      ...prepared.request,
      system: `${prepared.request.system}${buildRetryDirective(evaluation.flags)}`,
    };
  }

  return {
    accepted: false,
    notice:
      "The live draft did not clear the sourcing gate. Saturday Signal used its verified local read instead.",
  };
}

// The gate: the team's voice contract, plus every inline citation tag having to
// name a source that was actually retrieved. The second check is the one that
// protects the product's core claim — before it, a model could emit
// "[Definitely Real Source]" and pass.
function evaluateAnswer(prepared: PreparedGeneration, text: string) {
  return evaluateVoiceSample(text, {
    contract: prepared.team.voice,
    validCitationTitles: prepared.citations.map((citation) => citation.title),
  });
}

type PreparedGeneration = {
  kind: "generate";
  strategy: "composer" | "escalate";
  capability?: ComposerCapability;
  team: TeamConfig;
  request: LlmRequest;
  citations: ChatCitation[];
  freshness: string;
};

type PreparedAnswer = { kind: "static"; answer: ChatAnswer } | PreparedGeneration;

async function prepareAnswer(
  question: string,
  teamSlug: string,
  options: AnswerOptions,
): Promise<PreparedAnswer> {
  const team = getTeamConfig(teamSlug);

  if (!team) {
    throw new Error(`Unknown team slug: ${teamSlug}`);
  }

  const ingest = await collectSourceDocuments(team.slug);
  const hits = await retrieveHybrid(question, ingest.documents, team.slug, 4);
  const citations = createCitations(hits.map((hit) => hit.chunk.document));
  const freshness = createFreshness(team.slug, citations, ingest.warnings);
  const officialCitations = createCitations(
    ingest.documents.filter((document) => document.provider === "official"),
  );

  // Both guardrails short-circuit before any provider call, so a rumour probe
  // or an unanswerable question never costs anything.
  if (rumorPattern.test(question)) {
    const anchor = officialCitations.length > 0 ? officialCitations : citations;
    return {
      kind: "static",
      answer: {
        teamSlug: team.slug,
        answer: `I would not treat that as confirmed from this source set. Saturday Signal can speak to the published schedule and trusted primary links for ${team.displayName}, but it should not launder injury, betting, or message-board claims without a real source. Freshness only holds for what the record actually verifies.`,
        citations: anchor.slice(0, 1),
        confidence: "low",
        freshness,
        mode: "guardrail",
        provider: "policy",
        model: "guardrail",
      },
    };
  }

  if (hits.length === 0) {
    const anchor =
      officialCitations.length > 0
        ? officialCitations
        : createCitations(ingest.documents.slice(0, 1));
    return {
      kind: "static",
      answer: {
        teamSlug: team.slug,
        answer: `The current source set does not confirm enough to answer that cleanly. Ask for the next-game brief, schedule context, or a sourced opponent note and I can stay on firmer ground about ${team.shortName} on early downs and field position.`,
        citations: anchor.slice(0, 1),
        confidence: "low",
        freshness,
        mode: "no-context",
        provider: "policy",
        model: "guardrail",
      },
    };
  }

  const selected = selectAnswerStrategy(team, question, hits);
  const capability = selected.strategy === "composer" ? selected.capability : undefined;

  return {
    kind: "generate",
    strategy: selected.strategy,
    capability,
    team,
    request: buildChatRequest(team, question, hits, options.history ?? [], capability),
    citations,
    freshness,
  };
}

function finalizeAnswer(
  prepared: PreparedGeneration,
  providerName: string,
  model: string,
  text: string,
  notice?: string,
): ChatAnswer {
  return {
    teamSlug: prepared.team.slug,
    answer: text,
    citations: prepared.citations,
    confidence: notice ? "low" : prepared.citations.length >= 2 ? "high" : "medium",
    freshness: prepared.freshness,
    notice,
    mode: "grounded",
    provider: providerName,
    model,
  };
}

function createCitations(
  documents: Array<{
    id: string;
    title: string;
    sourceUrl?: string;
    provider: string;
    sourceType: string;
  }>,
) {
  const seen = new Map<string, ChatCitation>();

  for (const document of documents) {
    seen.set(document.id, {
      id: document.id,
      title: document.title,
      sourceUrl: document.sourceUrl,
      provider: document.provider,
      sourceType: document.sourceType,
    });
  }

  return [...seen.values()].slice(0, 4);
}

function createFreshness(teamSlug: string, citations: ChatCitation[], warnings: string[]) {
  const providers = [
    ...new Set(citations.map((citation) => publicProviderLabel(citation.provider))),
  ].join(", ");
  const schedule = getTeamSchedule(teamSlug);
  const captured = schedule ? formatCaptureDate(schedule.capturedAt) : "an unknown date";
  const coverageNote =
    warnings.length > 0 ? " Season statistics are not yet part of this answer." : "";

  return `Sources: ${providers || "schedule record"}. Schedule checked ${captured}.${coverageNote}`;
}

function publicProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    fixture: "schedule and desk notes",
    official: "official links",
    cfbd: "season statistics",
  };

  return labels[provider] ?? "source record";
}
