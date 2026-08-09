import type { TeamConfig } from "@/config/team";
import type { ComposerCapability } from "@/server/llm/types";
import type { RetrievalHit } from "@/server/rag/retrieve";
import { getNextGame, getTeamSchedule } from "@/server/schedule/schedule";
import { getTeamRankingSummary } from "@/server/sources/rankings";
import { getWeeklyEdition } from "@/server/sources/weekly";

export type AnswerStrategy =
  | { strategy: "composer"; capability: ComposerCapability }
  | { strategy: "escalate" };

// Phrases that mean "tell me about the upcoming game" rather than merely
// mentioning it. The previous classifier matched a bare /next/, so "What should
// the offense fix before the next game?" was served the canned schedule
// template. Intent lives in the ask, not in the noun.
const briefingPattern =
  /\b(next[\s-]game|game[\s-]week)\b|\bbrief(ing)?\b|\bpreview\b|\bopener\b|\bwho(?:'s| is| do we| do they) (?:next|play)\b|\bwhat time\b|\bkick(?:off| off)\b/i;

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

// Poll questions. "Ranked" is the word a fan uses whether they are asking
// about their own team or their opponents, and both are answered by the same
// per-team ranking view.
const rankingPattern =
  /\brank(?:ed|ing|ings)?\b|\btop 25\b|\bpolls?\b|\bap poll\b|\bcoaches poll\b/i;

// "What happened this week" — the weekly package, not the season.
const newsPattern =
  /\bnews\b|\blatest\b|\bheadlines?\b|\bthis week\b|\bwhat'?s? (?:new|going on|happening)\b|\bany updates?\b/i;

const titleStopwords = new Set(["a", "an", "and", "for", "of", "on", "the", "to", "vs", "with"]);

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
  const matchingTeamNote = hits.find(
    (hit) =>
      hit.chunk.document.sourceType === "team-note" &&
      titleMatchesQuestion(hit.chunk.document.title, question),
  );

  const wantsBriefing = briefingPattern.test(question) || asksWhoTheTeamPlays(team, question);

  if (!wantsAnalysis && wantsBriefing && getNextGame(team.slug)) {
    return { strategy: "composer", capability: "next-game-brief" };
  }

  if (!wantsAnalysis && schedulePattern.test(question) && hasSchedule(team.slug)) {
    return { strategy: "composer", capability: "schedule" };
  }

  if (sourceReadinessPattern.test(question)) {
    return { strategy: "composer", capability: "source-readiness" };
  }

  // Same rule as every other capability: the pattern has to match and the
  // facts have to exist. A poll question with no published poll escalates
  // rather than being answered from whatever else retrieval turned up.
  if (rankingPattern.test(question) && getTeamRankingSummary(team)) {
    return { strategy: "composer", capability: "ranking-brief" };
  }

  if (newsPattern.test(question) && getWeeklyEdition(team.slug)) {
    return { strategy: "composer", capability: "news-brief" };
  }

  // Curated team notes are the product's differentiated content. Schedule facts
  // can outrank a note on an opponent-name match, so use the best retrieved note
  // instead of turning an analysis question into a date-and-time recital.
  if (
    (hits[0]?.chunk.document.sourceType === "team-note" || matchingTeamNote) &&
    !comparisonPattern.test(question)
  ) {
    return { strategy: "composer", capability: "team-note-brief" };
  }

  return { strategy: "escalate" };
}

// "Who does Utah State play next?" — the team's own name sits in the middle of
// the ask, so that slot has to come from config. The pattern this replaced put
// a bare `\w+` there, which matched "Texas" and quietly escalated the same
// question for every team whose name is more than one word. A promoted prompt
// that escalates is the product paying for its own front page, so the fix
// belongs here rather than in a carefully worded prompt.
function asksWhoTheTeamPlays(team: TeamConfig, question: string): boolean {
  // Longest first: alternation is ordered, so "Utah State football" must get a
  // chance before "Utah State".
  const names = [team.shortName, team.displayName, ...team.aliases]
    .map(escapeRegExp)
    .sort((left, right) => right.length - left.length)
    .join("|");

  const pattern = new RegExp(
    `\\bwho(?:'s|\\s+is|\\s+are|\\s+do(?:es)?)?\\s+(?:the\\s+)?(?:${names})\\s+(?:play(?:s|ing)?|face|host|open against)\\b`,
    "i",
  );

  return pattern.test(question);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function titleMatchesQuestion(title: string, question: string): boolean {
  const titleWords = normalizeWords(title);
  const normalizedQuestion = normalizeWords(question).join(" ");

  for (let index = 0; index < titleWords.length - 1; index += 1) {
    const left = titleWords[index];
    const right = titleWords[index + 1];

    if (titleStopwords.has(left) || titleStopwords.has(right)) {
      continue;
    }

    if (normalizedQuestion.includes(`${left} ${right}`)) {
      return true;
    }
  }

  return false;
}

function normalizeWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function hasSchedule(teamSlug: string): boolean {
  const schedule = getTeamSchedule(teamSlug);

  return Boolean(schedule && schedule.games.length > 0);
}
