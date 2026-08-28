import { getSourceReadiness, type TeamConfig } from "@/config/team";
import { formatCaptureDate, getNextGame, getTeamSchedule } from "@/server/schedule/schedule";
import type { RetrievalHit } from "@/server/rag/retrieve";
import { getRankingDocuments } from "@/server/sources/rankings";
import type { SourceDocument } from "@/server/sources/types";
import { getWeeklyNewsDocuments } from "@/server/sources/weekly";
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
    `You are Section One, an independent fan intelligence analyst covering ${team.displayName}.`,
    `Persona: ${team.voice.posture}. Use football-native language such as ${preferredTerms}.`,
    `Never use these phrases: ${bannedPhrases}. No toxic rivalry bait, no betting certainty, no unsupported injury speculation.`,
    `${team.sourcePolicy.disclaimer} Never imply official affiliation.`,
    // The second sentence used to say "say what the corpus is missing", and
    // the model did exactly that — fans were told about the corpus. Say what
    // is not known in football terms; never name the machinery.
    "Ground every factual claim in the source excerpts below. Cite sources inline as [source title]. If the sources do not cover it, say plainly what is not known yet in football terms — what has not been seen on the field, or what has not been reported. Never mention sources, documents, excerpts, or a corpus as things; a fan does not know those exist.",
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
  const direct = directExcerpts(team, capability);
  const excerpts =
    direct.length > 0
      ? direct
      : groundingHits.map((hit) => ({
          title: hit.chunk.document.title,
          content: hit.chunk.content,
        }));

  return {
    teamName: team.shortName,
    teamDisplayName: team.displayName,
    seasonYear: schedule?.seasonYear,
    capability,
    nextGame: nextGame ? toScheduleFact(nextGame) : undefined,
    upcomingGames: (schedule?.games ?? []).slice(0, schedulePreviewLength).map(toScheduleFact),
    sourceReadiness: getSourceReadiness(team),
    scheduleCapturedAt: schedule ? formatCaptureDate(schedule.capturedAt) : undefined,
    excerpts,
    citationTitles: dedupe(excerpts.map((excerpt) => excerpt.title)),
  };
}

// Capabilities whose answer is a specific document rather than whatever
// retrieval liked best.
//
// Reordering retrieved hits is not enough here, and that is worth spelling
// out: retrieval ranks by term overlap, so "Utah State" scores far higher
// across twelve game rows than in one poll entry, and the ranking document
// never made the cut to be reordered. Sorting a list that does not contain
// the answer produces a confident answer to a different question — which is
// exactly what "is Utah State ranked?" got back. These capabilities read the
// same source documents the page renders, the way next-game-brief already
// reads the schedule.
export function getCapabilityDocuments(
  team: TeamConfig,
  capability?: ComposerCapability,
): SourceDocument[] {
  if (capability === "ranking-brief") {
    return getRankingDocuments(team);
  }

  if (capability === "news-brief") {
    return getWeeklyNewsDocuments(team.slug);
  }

  return [];
}

function directExcerpts(
  team: TeamConfig,
  capability?: ComposerCapability,
): Array<{ title: string; content: string }> {
  return getCapabilityDocuments(team, capability).map((document) => ({
    title: document.title,
    content: document.body,
  }));
}

export function prioritizeGroundingHits(
  question: string,
  hits: RetrievalHit[],
  capability?: ComposerCapability,
  promotedNoteId?: string,
): RetrievalHit[] {
  if (capability !== "team-note-brief") {
    return hits;
  }

  return [...hits].sort(
    (left, right) =>
      rankTeamNote(right, question, promotedNoteId) -
      rankTeamNote(left, question, promotedNoteId),
  );
}

function rankTeamNote(hit: RetrievalHit, question: string, promotedNoteId?: string): number {
  if (hit.chunk.document.sourceType !== "team-note") {
    return 0;
  }

  // A promoted prompt names its note in config, and that beats both text
  // signals: the note it points at is the one the cue was written for, whether
  // or not the two share any wording.
  if (promotedNoteId && hit.chunk.document.metadata?.noteId === promotedNoteId) {
    return 3;
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
