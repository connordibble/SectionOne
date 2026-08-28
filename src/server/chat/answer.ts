import { defaultTeamConfig, getTeamConfig, type TeamConfig } from "@/config/team";
import { evaluateVoiceSample, extractCitationTags } from "@/lib/content/voice";
import { collectSourceDocuments } from "@/server/ingest/pipeline";
import { chunkText, createMockLlmProvider } from "@/server/llm/mock";
import { resolveLlmProvider } from "@/server/llm/registry";
import type { ComposerCapability, LlmEnv, LlmProvider, LlmRequest } from "@/server/llm/types";
import { recordLlmUsage } from "@/server/llm/usage";
import { reportDegradation } from "@/server/observability/report";
import { retrieveHybrid } from "@/server/rag/hybrid";
import type { RetrievalHit } from "@/server/rag/retrieve";
import { formatCaptureDate, getTeamSchedule } from "@/server/schedule/schedule";
import { getWeeklyEdition } from "@/server/sources/weekly";
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
import { searchWithGrounding, type WebSearchResult } from "./web-search";
import {
  toPublicAnswer,
  type ChatAnswer,
  type ChatCitation,
  type ChatFreshness,
  type ChatStreamEvent,
} from "./types";

// Keep the policy gate precise. Bare substring matches turned normal football
// language such as "better" and "lock in" into betting refusals.
//
// This matches how a claim arrived, not what it is about. The policy everywhere
// it is written down — story-selection.md, voice.md, and the system prompt — is
// "no injury *speculation*", and the word this gate needs is the second one.
// Matching `injur` refused the subject instead, so "Any concerning injuries
// ahead of the season?" came back as a refusal while the Brief on the same page
// published Goosby's bone bruise, sourced to ESPN. The product cannot report a
// thing and then decline to discuss it.
//
// Injury questions now take the normal path, where the citation gate makes an
// unsupported claim fail and `findUncoveredSubject` catches a player the
// evidence never names. What still refuses is hearsay offered as evidence: a
// rumour, a message board, something someone heard.
const rumorPattern = /\b(?:rumou?r|message board|heard|leak(?:ed|s)?)\b/i;
const bettingPattern =
  /\b(?:bet(?:ting)?|wager(?:ing)?|odds?|moneyline|spread|parlay)\b|\b(?:guaranteed|sure)\s+lock\b|\block(?:ed)?\s+(?:pick|play|of the week)\b/i;

// These forms name one person or subject and ask for a factual status. If the
// retrieved evidence never names that subject, a model has no basis for an
// answer. The narrow grammar is deliberate: broad analysis questions such as
// "what happened on early downs?" still belong on the normal retrieval path.
const namedSubjectPatterns = [
  /^\s*what happened (?:to|with)\s+(.+?)[?.!]*\s*$/i,
  /^\s*(?:what(?:'s| is) the )?status (?:of|on|with)\s+(.+?)[?.!]*\s*$/i,
  /^\s*where is\s+(.+?)[?.!]*\s*$/i,
];

const currentRosterQuestionPattern =
  /\b(?:who(?:'s| is| will be)|is\s+.+?)\s+(?:the\s+)?(?:expected\s+)?(?:starting\s+)?(?:quarterback|running back|wide receiver|tight end|left tackle|right tackle|left guard|right guard|center|defensive tackle|defensive end|linebacker|cornerback|safety|kicker|punter)\b|\bdepth chart\b/i;

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

  if (prepared.kind === "search") {
    return produceSearchAnswer(prepared, options.env);
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
  // Deliberately not streamed from the provider. The acceptance gate can reject
  // an answer for off-tone language or a fabricated citation, and once a delta
  // is on the wire that rejection is unenforceable — a retry cannot un-send
  // text the browser already rendered. So: generate fully, validate, then chunk
  // the accepted text. At ~300 output tokens the latency cost is small and the
  // quality guarantee becomes real rather than advisory.
  const answer =
    prepared.kind === "search"
      ? await produceSearchAnswer(prepared, options.env)
      : await produceAnswer(prepared, options.env);

  yield { type: "citations", citations: answer.citations };

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
  const runtimeEnv = env ?? process.env;
  const resolved = resolveLlmProvider(runtimeEnv);
  const provider = resolved.provider;

  // Quality-first launch posture: OpenAI researches and verifies every normal
  // question with the curated edition as supporting context. The local
  // composer is the fallback, not the primary chat experience.
  if (provider.name === "openai") {
    const budget = await checkBudget(runtimeEnv);

    if (budget.withinBudget) {
      const searched = await generateSearchedAnswer(prepared, runtimeEnv);

      if (searched.answer) {
        return searched.answer;
      }

      if (prepared.strategy === "escalate") {
        return searchedQuestionFallback(prepared, searched.notice);
      }

      const fallback = await composer.generate(prepared.request);
      return finalizeAnswer(
        prepared,
        composer.name,
        fallback.model,
        fallback.text,
        searched.notice,
      );
    }

    const capped = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, capped.model, capped.text, budget.notice);
  }

  if (prepared.strategy === "composer") {
    const result = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, result.model, result.text);
  }

  // Consulted only on the escalation path. A composer answer is already free
  // and instant, so a cache lookup there would add a database round trip to
  // save nothing.
  const cached = await lookupCachedAnswer(prepared.team.slug, prepared.question, runtimeEnv);

  if (cached.hit) {
    return { ...cached.answer, provider: "cache", model: cached.via };
  }

  // No live provider configured: the composer is the whole product, not a
  // degraded mode. Nothing to warn about.
  if (provider.name === composer.name) {
    const result = await composer.generate(prepared.request);
    return finalizeAnswer(prepared, composer.name, result.model, result.text);
  }

  // Checked only on the paid path. A composer answer is free and must never
  // be blocked by a spend ceiling.
  const budget = await checkBudget(runtimeEnv);

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

function searchedQuestionFallback(
  prepared: PreparedGeneration,
  notice?: string,
): ChatAnswer {
  return {
    teamSlug: prepared.team.slug,
    answer: currentRosterQuestionPattern.test(prepared.question)
      ? "I could not verify a current depth-chart answer from reliable reporting. The role may still be unsettled; try again shortly or ask about the latest depth chart."
      : "I could not verify a reliable current answer. Try again shortly or narrow the question to a player, role, game, or report.",
    citations: [],
    freshness: prepared.freshness,
    notice,
    mode: "no-context",
    provider: "policy",
    model: "evidence-gate",
  };
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
    notice: "That answer could not be verified, so it was not shown.",
  };
}

// The gate: the team's voice contract, plus every inline citation tag having to
// name a source that was actually retrieved. The second check is the one that
// protects the product's core claim — before it, a model could emit
// "[Definitely Real Source]" and pass.
function evaluateAnswer(prepared: PreparedGeneration, text: string) {
  return evaluateGroundedText(prepared.team, prepared.citations, text);
}

function evaluateGroundedText(
  team: TeamConfig,
  citations: ChatCitation[],
  text: string,
  requireFootballLanguage = true,
) {
  return evaluateVoiceSample(text, {
    contract: team.voice,
    validCitationTitles: citations.map((citation) => citation.title),
    requireFootballLanguage,
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
  freshness: ChatFreshness;
};

type PreparedSearch = {
  kind: "search";
  team: TeamConfig;
  question: string;
  request: LlmRequest;
  citations: ChatCitation[];
  requiredAnswerTerms: string[];
  fallback: ChatAnswer;
};

type PreparedAnswer =
  | { kind: "static"; answer: ChatAnswer }
  | PreparedSearch
  | PreparedGeneration;

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

  // Policy guardrails short-circuit before any provider call, so a rumour or
  // betting probe never costs anything.
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

  const uncoveredSubject = findUncoveredSubject(question, hits);

  if (uncoveredSubject) {
    const fallback: ChatAnswer = {
      teamSlug: team.slug,
      answer: `I could not verify a reliable current report about ${uncoveredSubject}. Try again shortly or include the player's team, position, or the report you saw.`,
      citations: [],
      freshness,
      mode: "no-context",
      provider: "policy",
      model: "evidence-gate",
    };

    return {
      kind: "search",
      team,
      question,
      request: buildChatRequest(team, question, [], options.history ?? []),
      citations: [],
      requiredAnswerTerms: [uncoveredSubject],
      fallback,
    };
  }

  if (hits.length === 0) {
    const anchor =
      officialCitations.length > 0
        ? officialCitations
        : createCitations(ingest.documents.slice(0, 1));
    return {
      kind: "search",
      team,
      question,
      request: buildChatRequest(team, question, [], options.history ?? []),
      citations: [],
      requiredAnswerTerms: [],
      fallback: {
        teamSlug: team.slug,
        answer: `I could not verify a reliable current answer. Try again shortly or narrow the question to a player, role, game, or report about ${team.shortName}.`,
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
    4,
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

async function produceSearchAnswer(
  prepared: PreparedSearch,
  env: LlmEnv = process.env,
): Promise<ChatAnswer> {
  const resolved = resolveLlmProvider(env);

  // Search is an OpenAI-only capability. A mock or Anthropic deployment keeps
  // the evidence-gate refusal and does not make a second provider choice.
  if (resolved.provider.name !== "openai") {
    return prepared.fallback;
  }

  const budget = await checkBudget(env);

  if (!budget.withinBudget) {
    return { ...prepared.fallback, notice: budget.notice };
  }

  try {
    const searched = await generateSearchedAnswer(prepared, env, prepared.requiredAnswerTerms);

    if (!searched.answer) {
      return prepared.fallback;
    }
    return searched.answer;
  } catch (error) {
    reportDegradation(
      `live reporting search failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        scope: "chat/web-search",
        fingerprint: "chat/web-search:request",
      },
    );
    return {
      ...prepared.fallback,
      notice: "Live reporting was unavailable. This answer remains limited to the published edition.",
    };
  }
}

type SearchablePrepared = {
  team: TeamConfig;
  question: string;
  request: LlmRequest;
  citations: ChatCitation[];
  freshness?: ChatFreshness;
  fallback?: ChatAnswer;
};

async function generateSearchedAnswer(
  prepared: SearchablePrepared,
  env: LlmEnv,
  requiredAnswerTerms: string[] = [],
): Promise<{ answer?: ChatAnswer; notice?: string }> {
  let lastFailure = "research did not produce a supported answer";

  // One clean retry is worth the latency at launch. Search is non-deterministic,
  // and the misses found in the live evaluation were usually resolved by a
  // different exact query rather than by changing the answer policy.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result;

    try {
      result = await searchWithGrounding(prepared.team, prepared.request, {
        env,
        retryDirective:
          attempt === 0
            ? undefined
            : "This is a second research pass because the first did not yield a citable answer. Change the query strategy: search the exact role, player, award, or game wording; check the newest dated report and the official team site; then answer from the strongest direct evidence rather than repeating the abstention.",
      });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
      continue;
    }

    const assessment = assessSearchedAnswer(prepared, result, requiredAnswerTerms);

    if (result.usage) {
      await recordLlmUsage({
        teamSlug: prepared.team.slug,
        provider: "openai-web-search",
        usage: result.usage,
        accepted: assessment.passed,
      });
    }

    if (assessment.passed) {
      let finalResult = result;
      let finalAssessment = assessment;

      try {
        const verified = await searchWithGrounding(prepared.team, prepared.request, {
          env,
          previousResponseId: result.responseId,
          verificationDraft: {
            text: result.text,
            citations: assessment.usedCitations,
          },
        });
        const verifiedAssessment = assessSearchedAnswer(
          prepared,
          verified,
          requiredAnswerTerms,
        );

        if (verified.usage) {
          await recordLlmUsage({
            teamSlug: prepared.team.slug,
            provider: "openai-web-search-verifier",
            usage: verified.usage,
            accepted: verifiedAssessment.passed,
          });
        }

        if (verifiedAssessment.passed) {
          finalResult = verified;
          finalAssessment = verifiedAssessment;
        } else {
          reportDegradation(
            `live reporting verifier rejected its revision: ${verifiedAssessment.flags.join("; ")}`,
            {
              scope: "chat/web-search",
              fingerprint: "chat/web-search:verification",
            },
          );
        }
      } catch (error) {
        reportDegradation(
          `live reporting verification unavailable: ${error instanceof Error ? error.message : String(error)}`,
          {
            scope: "chat/web-search",
            fingerprint: "chat/web-search:verification",
          },
        );
      }

      return {
        answer: {
          teamSlug: prepared.team.slug,
          answer: keepDisplayedCitationTags(finalResult.text, finalAssessment.usedCitations),
          citations: finalAssessment.usedCitations,
          freshness: {
            ...(prepared.freshness ?? prepared.fallback!.freshness),
            search: `Live reporting checked ${formatCaptureDate(new Date().toISOString())}.`,
          },
          mode: "grounded",
          provider: "openai-web-search",
          model: finalResult.model,
        },
      };
    }

    lastFailure = `${assessment.flags.join("; ")}; used citations: ${assessment.usedCitations.length}`;
  }

  reportDegradation(`live reporting answer rejected after retry: ${lastFailure}`, {
    scope: "chat/web-search",
    fingerprint: "chat/web-search:acceptance",
  });
  return {};
}

type SearchAssessment = {
  passed: boolean;
  flags: string[];
  usedCitations: ChatCitation[];
};

function assessSearchedAnswer(
  prepared: SearchablePrepared,
  result: WebSearchResult,
  requiredAnswerTerms: string[],
): SearchAssessment {
  const candidateCitations = dedupeCitations([...prepared.citations, ...result.citations]);
  const usedCitations = limitDisplayedCitations(
    selectReferencedCitations(candidateCitations, result.text),
  );
  const normalizedAnswer = normalizeEvidenceText(result.text);
  const supportFlags = [
    ...(usedCitations.length === 0 ? ["no cited source"] : []),
    ...(isUnsupportedResearchAnswer(result.text) ? ["agent abstained"] : []),
    ...(requiredAnswerTerms.some((term) => !answerIncludesTerm(normalizedAnswer, term))
      ? ["named subject missing from answer"]
      : []),
  ];
  const evaluation =
    supportFlags.length > 0
      ? { passed: false, flags: supportFlags }
      : evaluateGroundedText(prepared.team, candidateCitations, result.text, false);

  return { ...evaluation, usedCitations };
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
    citations: selectReferencedCitations(prepared.citations, text),
    freshness: prepared.freshness,
    notice,
    mode: "grounded",
    provider: providerName,
    model,
  };
}

function selectReferencedCitations(citations: ChatCitation[], text: string): ChatCitation[] {
  const usedTitles = new Set(
    extractCitationTags(text).map((title) => normalizeEvidenceText(title)),
  );

  return citations.filter((citation) => usedTitles.has(normalizeEvidenceText(citation.title)));
}

function dedupeCitations(citations: ChatCitation[]): ChatCitation[] {
  return [...new Map(citations.map((citation) => [citation.sourceUrl ?? citation.id, citation])).values()];
}

function limitDisplayedCitations(citations: ChatCitation[]): ChatCitation[] {
  const directWebCitations = citations.filter(
    (citation) => citation.sourceType === "live-reporting",
  );
  const eligible = directWebCitations.length > 0 ? directWebCitations : citations;
  const selected: ChatCitation[] = [];
  const webProviders = new Set<string>();

  // Later web annotations tend to be the more specific page after a broad
  // result establishes context. Walk backward so two links from one outlet do
  // not crowd the rail while the more directly used page is discarded.
  for (const citation of [...eligible].reverse()) {
    if (citation.sourceType === "live-reporting") {
      if (webProviders.has(citation.provider)) {
        continue;
      }
      webProviders.add(citation.provider);
    }

    selected.unshift(citation);
    if (selected.length === 2) {
      break;
    }
  }

  return selected;
}

function answerIncludesTerm(normalizedAnswer: string, term: string): boolean {
  const compact = (value: string) =>
    normalizeEvidenceText(value).replaceAll(/[^\p{L}\p{N}]/gu, "");
  const normalizedTerm = compact(term);
  return (
    compact(normalizedAnswer).includes(normalizedTerm)
  );
}

function isUnsupportedResearchAnswer(text: string): boolean {
  const normalized = text.trimStart().toLowerCase();
  return (
    normalized.startsWith("no approved source establishes") ||
    normalized.startsWith("current reporting does not establish")
  );
}

function keepDisplayedCitationTags(text: string, citations: ChatCitation[]): string {
  const shown = new Set(citations.map((citation) => normalizeEvidenceText(citation.title)));

  return text
    .replaceAll(/\[([^\]]+)\]/gu, (tag, title: string) =>
      shown.has(normalizeEvidenceText(title)) ? tag : "",
    )
    .replaceAll(/\s+/gu, " ")
    .trim();
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

function createFreshness(teamSlug: string, warnings: string[]): ChatFreshness {
  const schedule = getTeamSchedule(teamSlug);
  const edition = getWeeklyEdition(teamSlug);

  return {
    coverage: edition
      ? `Coverage updated ${formatCaptureDate(edition.publishedAt)}.`
      : "Coverage date unavailable.",
    schedule: schedule
      ? `Schedule updated ${formatCaptureDate(schedule.capturedAt)}.`
      : "Schedule date unavailable.",
    ...(warnings.length > 0 ? { context: "No 2026 stats yet." } : {}),
  };
}

function findUncoveredSubject(question: string, hits: RetrievalHit[]): string | undefined {
  const subject = namedSubjectPatterns
    .map((pattern) => question.match(pattern)?.[1]?.trim())
    .find((candidate): candidate is string => Boolean(candidate));

  if (!subject || subject.length > 80) {
    return undefined;
  }

  const normalizedSubject = normalizeEvidenceText(subject).replace(/^the\s+/, "");

  if (!normalizedSubject || normalizedSubject.split(" ").length > 6) {
    return undefined;
  }

  const covered = hits.some((hit) =>
    normalizeEvidenceText(`${hit.chunk.document.title} ${hit.chunk.content}`).includes(
      normalizedSubject,
    ),
  );

  return covered ? undefined : subject.replace(/[?.!]+$/, "");
}

function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
