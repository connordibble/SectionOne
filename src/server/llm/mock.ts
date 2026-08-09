import { formatSite } from "@/server/schedule/schedule";
import type { GroundingContext, LlmProvider, LlmRequest, ScheduleGameFact } from "./types";

// Deterministic provider. It composes answers from grounding facts the chat
// layer already verified, so every claim is backed by the source corpus and the
// app works fully offline. This is the default path for questions routing.ts
// says it can genuinely answer — not merely a failure fallback.
export function createMockLlmProvider(): LlmProvider {
  return {
    name: "mock",
    model: "deterministic-composer",

    async generate(request: LlmRequest) {
      return { text: composeAnswer(request), model: "deterministic-composer" };
    },

    async *stream(request: LlmRequest) {
      yield* chunkText(composeAnswer(request));
    },
  };
}

// Shared so buffered answers and composed answers reach the UI the same way.
export function* chunkText(text: string, chunkSize = 6): Generator<string, void, void> {
  const words = text.split(" ");

  for (let start = 0; start < words.length; start += chunkSize) {
    const chunk = words.slice(start, start + chunkSize).join(" ");
    yield start === 0 ? chunk : ` ${chunk}`;
  }
}

function composeAnswer(request: LlmRequest): string {
  const grounding = request.grounding;

  if (!grounding) {
    return "The source record does not support that question cleanly. Keep the read to early downs, field position, and the line of scrimmage until a named source can carry more. Freshness cannot be confirmed without a matching record.";
  }

  switch (grounding.capability) {
    case "next-game-brief":
      return composeNextGameBrief(grounding);
    case "schedule":
      return composeSchedule(grounding);
    case "source-readiness":
      return composeSourceReadiness(grounding);
    case "team-note-brief":
      return composeTeamNoteBrief(grounding);
    default:
      return composeGeneral(grounding);
  }
}

function composeNextGameBrief(grounding: GroundingContext): string {
  const game = grounding.nextGame;

  if (!game) {
    return composeGeneral(grounding);
  }

  const tv = game.tv ? ` on ${game.tv}` : "";
  const season = grounding.seasonYear ? `${grounding.seasonYear} ` : "";

  return finish(
    `${grounding.teamName} opens the ${season}schedule ${formatSite(game.site)} ${game.opponent} on ${game.dateLabel} at ${game.venue}, with kickoff set for ${game.kickoff}${tv}. The useful football read is not just the opponent name; it is whether ${grounding.teamName} wins early downs, owns the line of scrimmage, and keeps the operation clean before the schedule tightens.`,
    grounding,
  );
}

function composeSchedule(grounding: GroundingContext): string {
  if (grounding.upcomingGames.length === 0) {
    return composeGeneral(grounding);
  }

  const season = grounding.seasonYear ? `${grounding.seasonYear} ` : "";
  const lines = grounding.upcomingGames.map(describeGame).join("; ");

  return finish(
    `The ${season}slate opens ${lines}. Field position and early-down efficiency travel week to week, so the useful read is where the schedule stacks real line-of-scrimmage tests back to back rather than any single opponent name.`,
    grounding,
  );
}

function composeSourceReadiness(grounding: GroundingContext): string {
  const ready = grounding.sourceReadiness
    .map((source) => `${source.label} (${source.state})`)
    .join(", ");

  return finish(
    `Here is what the answer can stand on right now: ${ready}. Schedule and game context are on firm ground. Pressure, coverage, and success-rate comparisons stay provisional until season statistics are ready.`,
    grounding,
  );
}

function composeTeamNoteBrief(grounding: GroundingContext): string {
  const note = grounding.excerpts[0];

  if (!note) {
    return composeGeneral(grounding);
  }

  return finish(
    `${firstSentences(note.content, 3)} That is the early-down and line-of-scrimmage lens to carry into game week for ${grounding.teamName}.`,
    grounding,
  );
}

function composeGeneral(grounding: GroundingContext): string {
  const excerpt = grounding.excerpts[0];

  if (excerpt) {
    return finish(
      `${firstSentences(excerpt.content, 2)} For ${grounding.teamName}, that is the early-down and line-of-scrimmage lens to carry into game week.`,
      grounding,
    );
  }

  return finish(
    `The source-backed read is to start with early downs, field position, and whether ${grounding.teamName} controls the line of scrimmage. The record is strongest on schedule and matchup context, so this answer should stay inside those lines until season statistics add more depth.`,
    grounding,
  );
}

function describeGame(game: ScheduleGameFact): string {
  return `${formatSite(game.site)} ${game.opponent} on ${game.dateLabel} at ${game.kickoff}`;
}

// Appends real citation tags, or an explicit freshness statement when the
// corpus produced none. The composer must never invent a bracketed tag: the
// acceptance gate validates every tag against retrieved titles, and a template
// that fabricates one would fail the same check an off-tone model would.
function finish(body: string, grounding: GroundingContext): string {
  const tags = grounding.citationTitles.slice(0, 2);

  if (tags.length > 0) {
    return `${body} ${tags.map((title) => `[${title}]`).join(" ")}`.trim();
  }

  const captured = grounding.scheduleCapturedAt
    ? ` Schedule record checked ${grounding.scheduleCapturedAt}.`
    : "";

  return `${body} Freshness: no matching source was found for this answer.${captured}`.trim();
}

function firstSentences(content: string, count: number): string {
  const sentences = content.match(/[^.!?]+[.!?]+(?:\s|$)/g);

  if (!sentences) {
    return content.trim();
  }

  return sentences
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(" ");
}
