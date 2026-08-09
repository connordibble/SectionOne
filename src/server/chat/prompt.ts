import { getSourceReadiness, type TeamConfig } from "@/config/team";
import { formatCaptureDate, getNextGame, getTeamSchedule } from "@/server/schedule/schedule";
import type { RetrievalHit } from "@/server/rag/retrieve";
import type {
  ComposerCapability,
  GroundingContext,
  LlmMessage,
  LlmRequest,
  ScheduleGameFact,
} from "@/server/llm/types";
import { titleMatchesQuestion } from "./routing";

// How many games the schedule template lists before it stops being a scan and
// starts being a table dump.
const schedulePreviewLength = 6;

export const maxHistoryMessages = 8;
export const maxMessageLength = 4000;

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildChatRequest(
  team: TeamConfig,
  question: string,
  hits: RetrievalHit[],
  history: ChatHistoryMessage[] = [],
  capability?: ComposerCapability,
): LlmRequest {
  return {
    system: buildSystemPrompt(team, hits),
    messages: [...sanitizeHistory(history), { role: "user", content: question.trim() }],
    grounding: buildGroundingContext(team, question, hits, capability),
  };
}

// Appended to the system prompt on a retry after the acceptance gate rejected
// the first attempt. Naming the specific failures does better than a generic
// "try again" — the model gets told what tripped, not that something did.
export function buildRetryDirective(flags: string[]): string {
  return [
    "",
    "Your previous attempt was rejected for these reasons:",
    ...flags.map((flag) => `- ${flag}`),
    "Rewrite the answer to fix them. Only cite source titles exactly as they appear in the excerpts above; do not invent a citation.",
  ].join("\n");
}

// The voice contract, source policy, and grounding rules all come from typed
// team config so a second deployment inherits its own persona automatically.
function buildSystemPrompt(team: TeamConfig, hits: RetrievalHit[]): string {
  const preferredTerms = team.voice.preferredTerms.join(", ");
  const bannedPhrases = team.voice.bannedPhrases.join("; ");
  const excerpts = hits
    .map(
      (hit, index) =>
        `[${index + 1}] "${hit.chunk.document.title}" (${hit.chunk.document.provider}, fetched ${hit.chunk.document.fetchedAt})\n${hit.chunk.content}`,
    )
    .join("\n\n");

  return [
    `You are Saturday Signal, an independent fan intelligence analyst covering ${team.displayName}.`,
    `Persona: ${team.voice.posture}. Use football-native language such as ${preferredTerms}.`,
    `Never use these phrases: ${bannedPhrases}. No toxic rivalry bait, no betting certainty, no unsupported injury speculation.`,
    `${team.sourcePolicy.disclaimer} Never imply official affiliation.`,
    "Ground every factual claim in the source excerpts below. Cite sources inline as [source title]. If the excerpts do not support an answer, say what the corpus is missing instead of guessing.",
    "Keep answers to one tight paragraph unless asked for more.",
    "",
    "Source excerpts:",
    excerpts || "(no relevant sources retrieved)",
  ].join("\n");
}

// Intent no longer lives here. Routing owns the capability decision (see
// routing.ts) and passes it in, so this function's only job is to gather the
// facts that capability needs.
function buildGroundingContext(
  team: TeamConfig,
  question: string,
  hits: RetrievalHit[],
  capability?: ComposerCapability,
): GroundingContext {
  const schedule = getTeamSchedule(team.slug);
  const nextGame = getNextGame(team.slug);
  const groundingHits = prioritizeGroundingHits(question, hits, capability);

  return {
    teamName: team.shortName,
    teamDisplayName: team.displayName,
    seasonYear: schedule?.seasonYear,
    capability,
    nextGame: nextGame ? toScheduleFact(nextGame) : undefined,
    upcomingGames: (schedule?.games ?? []).slice(0, schedulePreviewLength).map(toScheduleFact),
    sourceReadiness: getSourceReadiness(team),
    scheduleCapturedAt: schedule ? formatCaptureDate(schedule.capturedAt) : undefined,
    excerpts: groundingHits.map((hit) => ({
      title: hit.chunk.document.title,
      content: hit.chunk.content,
    })),
    citationTitles: dedupe(groundingHits.map((hit) => hit.chunk.document.title)),
  };
}

export function prioritizeGroundingHits(
  question: string,
  hits: RetrievalHit[],
  capability?: ComposerCapability,
): RetrievalHit[] {
  if (capability !== "team-note-brief") {
    return hits;
  }

  return [...hits].sort(
    (left, right) => rankTeamNote(right, question) - rankTeamNote(left, question),
  );
}

function rankTeamNote(hit: RetrievalHit, question: string): number {
  if (hit.chunk.document.sourceType !== "team-note") {
    return 0;
  }

  return titleMatchesQuestion(hit.chunk.document.title, question) ? 2 : 1;
}

function toScheduleFact(game: {
  opponent: string;
  site: "home" | "away" | "neutral";
  dateLabel: string;
  kickoff: string;
  venue: string;
  tv: string | null;
}): ScheduleGameFact {
  return {
    opponent: game.opponent,
    site: game.site,
    dateLabel: game.dateLabel,
    kickoff: game.kickoff,
    venue: game.venue,
    tv: game.tv,
  };
}

export function sanitizeHistory(history: ChatHistoryMessage[]): LlmMessage[] {
  return history
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-maxHistoryMessages)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, maxMessageLength),
    }));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
