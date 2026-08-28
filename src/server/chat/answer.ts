import { defaultTeamConfig, getTeamConfig, type TeamConfig } from "@/config/team";
import { evaluateVoiceSample } from "@/lib/content/voice";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { chunkText, createMockLlmProvider } from "@/server/llm/mock";
import { resolveLlmProvider } from "@/server/llm/registry";
import type { ComposerCapability, LlmEnv, LlmProvider, LlmRequest } from "@/server/llm/types";
import { recordLlmUsage } from "@/server/llm/usage";
import { retrieveHybrid } from "@/server/rag/hybrid";
import { formatCaptureDate, getTeamSchedule } from "@/server/schedule/schedule";
import {
  buildChatRequest,
  buildRetryDirective,
  getCapabilityDocuments,
  prioritizeGroundingHits,
  type ChatHistoryMessage,
} from "./prompt";
import { runAfterResponse } from "@/server/http/after-response";
import { checkBudget } from "./budget";
import { lookupCachedAnswer, storeCachedAnswer } from "./cache";
import { promotedNoteFor, selectAnswerStrategy } from "./routing";
import { toPublicAnswer, type ChatAnswer, type ChatCitation, type ChatStreamEvent } from "./types";

// Keep the policy gate precise. Bare substring matches turned normal football
// language such as "better" and "lock in" into betting refusals.
const rumorPattern =
  /\b(?:rumou?r|message board|heard|leak(?:ed|s)?|injur(?:y|ies|ed|ing)?|out for season)\b/i;
const bettingPattern =
  /\b(?:bet(?:ting)?|wager(?:ing)?|odds?|moneyline|spread|parlay)\b|\b(?:guaranteed|sure)\s+lock\b|\block(?:ed)?\s+(?:pick|play|of the week)\b/i;

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

  // Consulted only on the escalation path. A composer answer is already free
  // and instant, so a cache lookup there would add a database round trip to
  // save nothing.
  const cached = await lookupCachedAnswer(prepared.team.slug, prepared.question, env ?? process.env);

  if (cached.hit) {
    return { ...cached.answer, provider: "cache", model: cached.via };
  }

  const resolved = resolveLlmProvider(env ?? process.env);
  const provider = resolved.provider;

  // No live provider configured: the composer is the whole product, not a
  // degraded mode. Nothing to warn about.
  if (provider.name === composer.name) {
    const result = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, result.model, result.text);
  }

  // Checked only on the paid path. A composer answer is free and must never
  // be blocked by a spend ceiling.
  const budget = await checkBudget(env ?? process.env);

  if (!budget.withinBudget) {
    const capped = await composer.generate(prepared.request);

    return finalizeAnswer(prepared, composer.name, capped.model, capped.text, budget.notice);
  }

  const attempt = await generateAccepted(prepared, provider);

  if (attempt.accepted) {
    const answer = finalizeAnswer(prepared, provider.name, attempt.model, attempt.text);

    // Deferred rather than awaited: a slow write must not delay the answer a
    // fan is already waiting on. Scheduled through `after` rather than left
    // unawaited, because a bare `void` promise is discarded the moment the
    // serverless instance freezes — which is why this cache stored nothing in
    // production while working fine locally.
    runAfterResponse(
      () => storeCachedAnswer(prepared.team.slug, prepared.question, toPublicAnswer(answer)),
      "chat/cache:write",
    );

    return answer;
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
          "The live answer service was unavailable. Section One used its verified local read instead.",
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
      "The live draft did not clear the sourcing gate. Section One used its verified local read instead.",
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
  // The question as asked. The request carries a built prompt; the cache keys
  // on what the fan actually typed.
  question: string;
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
  const retrievedCitations = createCitations(hits.map((hit) => hit.chunk.document));
  const freshness = createFreshness(team.slug, ingest.warnings);
  const officialCitations = createCitations(
    ingest.documents.filter((document) => document.provider === "official"),
  );

  // Both guardrails short-circuit before any provider call, so a rumour probe
  // or an unanswerable question never costs anything.
  if (rumorPattern.test(question) || bettingPattern.test(question)) {
    const anchor = officialCitations.length > 0 ? officialCitations : retrievedCitations;
    return {
      kind: "static",
      answer: {
        teamSlug: team.slug,
        answer: `That is not confirmed. Section One can check the published schedule and linked team pages for ${team.displayName}, but it will not repeat injury, betting, or message-board claims without a named source.`,
        citations: anchor.slice(0, 1),
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
        answer: `There is not enough here for a clean answer. Try the next game, the schedule, or what to watch on early downs for ${team.shortName}.`,
        citations: anchor.slice(0, 1),
        freshness,
        mode: "no-context",
        provider: "policy",
        model: "guardrail",
      },
    };
  }

  const selected = selectAnswerStrategy(team, question, hits);
  const capability = selected.strategy === "composer" ? selected.capability : undefined;
  const answerHits = prioritizeGroundingHits(
    question,
    hits,
    capability,
    promotedNoteFor(team, question),
  );
  // Ranking and news answers are composed from specific documents rather than
  // from whatever retrieval returned, so the sources shown to the fan — and
  // the titles the acceptance gate will accept — have to be those same
  // documents. Leaving these as the retrieved set would print one set of
  // sources under an answer built from another, and would make the gate reject
  // a citation that is in fact real.
  const capabilityDocuments = getCapabilityDocuments(team, capability);
  const citations = createCitations(
    capabilityDocuments.length > 0
      ? capabilityDocuments
      : answerHits.map((hit) => hit.chunk.document),
    selected.strategy === "composer" ? 2 : 4,
  );

  return {
    kind: "generate",
    strategy: selected.strategy,
    capability,
    team,
    question,
    request: buildChatRequest(team, question, answerHits, options.history ?? [], capability),
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
  limit = 4,
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

  return [...seen.values()].slice(0, limit);
}

function createFreshness(teamSlug: string, warnings: string[]) {
  const schedule = getTeamSchedule(teamSlug);
  const checked = schedule
    ? `Schedule updated ${formatCaptureDate(schedule.capturedAt)}.`
    : "Schedule date unavailable.";
  const coverageNote = warnings.length > 0 ? " No 2026 stats yet." : "";

  return `${checked}${coverageNote}`;
}
