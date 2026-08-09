import type { TeamConfig } from "@/config/team";
import type { ComposerCapability } from "@/server/llm/types";
import type { RetrievalHit } from "@/server/rag/retrieve";
import { getNextGame, getTeamSchedule } from "@/server/schedule/schedule";

export type AnswerStrategy =
  | { strategy: "composer"; capability: ComposerCapability }
  | { strategy: "escalate" };

// Phrases that mean "tell me about the upcoming game" rather than merely
// mentioning it. The previous classifier matched a bare /next/, so "What should
// the offense fix before the next game?" was served the canned schedule
// template. Intent lives in the ask, not in the noun.
const briefingPattern =
  /\b(next[\s-]game|game[\s-]week)\b|\bbrief(ing)?\b|\bpreview\b|\bopener\b|\bwho(?:'s| is| do we| do they| does \w+) (?:next|play)\b|\bwhat time\b|\bkick(?:off| off)\b/i;

const schedulePattern =
  /\bschedule\b|\bremaining games\b|\brest of (?:the )?season\b|\bfull slate\b|\bwho do we play this (?:season|year)\b/i;

const sourceReadinessPattern =
  /\b(?:what|which|whose) sources\b|\bsource (?:ledger|readiness|list|coverage)\b|\bhow fresh\b|\bdata sources\b|\bwhere .{0,20}data (?:come|coming) from\b/i;

// Markers that the question wants judgement — what to fix, watch, or worry
// about — rather than a recital of facts. These veto the fact-recital
// capabilities even when a briefing or schedule keyword is also present,
// because a template cannot answer them and shouldn't pretend to.
const analysisPattern =
  /\b(?:fix|improve|watch(?:ing)?|worry|worried|concern(?:ed|s)?|weak(?:ness|nesses)?|thin|struggle|attack|exploit|matter|why|how(?:'s| is| are)?|better|worse|should)\b/i;

// A team-note brief surfaces exactly one curated note. A question that asks to
// weigh two things against each other cannot be answered by one note, however
// well that note scores in retrieval, so comparisons always escalate.
const comparisonPattern =
  /\bcompare\b|\bcomparison\b|\bversus\b|\bvs\.?\b|\bboth\b|\bdifference between\b|\brather than\b|\beither\b/i;

// Picks the deterministic composer when it can genuinely answer, and escalates
// otherwise. Two things must hold to route to the composer: the question has to
// match a capability, and the facts that capability needs have to resolve.
// Matching alone is not enough — a next-game brief with no next game is not an
// answer.
export function selectAnswerStrategy(
  team: TeamConfig,
  question: string,
  hits: RetrievalHit[],
): AnswerStrategy {
  const wantsAnalysis = analysisPattern.test(question);

  if (!wantsAnalysis && briefingPattern.test(question) && getNextGame(team.slug)) {
    return { strategy: "composer", capability: "next-game-brief" };
  }

  if (!wantsAnalysis && schedulePattern.test(question) && hasSchedule(team.slug)) {
    return { strategy: "composer", capability: "schedule" };
  }

  if (sourceReadinessPattern.test(question)) {
    return { strategy: "composer", capability: "source-readiness" };
  }

  // Curated team notes are the product's differentiated content. When retrieval
  // puts one first, surfacing that note is better than paying a model to
  // paraphrase it — the note is the expert take, not a summary of one.
  if (
    hits[0]?.chunk.document.sourceType === "team-note" &&
    !comparisonPattern.test(question)
  ) {
    return { strategy: "composer", capability: "team-note-brief" };
  }

  return { strategy: "escalate" };
}

function hasSchedule(teamSlug: string): boolean {
  const schedule = getTeamSchedule(teamSlug);

  return Boolean(schedule && schedule.games.length > 0);
}
