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
    return "I do not have enough source material to answer that. Try the next game, the schedule, or what to watch on early downs.";
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
    `${grounding.teamName} opens the ${season}schedule ${formatSite(game.site)} ${game.opponent} on ${game.dateLabel}. Kickoff is ${game.kickoff}${tv} at ${game.venue}. Watch early downs, line play, and ball security.`,
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
    `The ${season}slate opens ${lines}. Watch where the toughest line-of-scrimmage tests stack up.`,
    grounding,
  );
}

function composeSourceReadiness(grounding: GroundingContext): string {
  const ready = grounding.sourceReadiness
    .map((source) => `${source.label} (${source.state})`)
    .join(", ");

  return finish(
    `Sources ready now: ${ready}. Schedule details are set. Line-of-scrimmage comparisons will get better once new stats arrive.`,
    grounding,
  );
}

function composeTeamNoteBrief(grounding: GroundingContext): string {
  const note = grounding.excerpts[0];

  if (!note) {
    return composeGeneral(grounding);
  }

  return finish(
    firstSentences(note.content, 2),
    grounding,
  );
}

function composeGeneral(grounding: GroundingContext): string {
  const excerpt = grounding.excerpts[0];

  if (excerpt) {
    return finish(firstSentences(excerpt.content, 2), grounding);
  }

  return finish(
    `Start with early downs, field position, and whether ${grounding.teamName} wins the line of scrimmage. Those are the clearest tells until new season stats arrive.`,
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
    ? ` Schedule checked ${grounding.scheduleCapturedAt}.`
    : "";

  return `${body} No matching source was found.${captured}`.trim();
}

function firstSentences(content: string, count: number): string {
  return content
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z][a-z])/)
    .slice(0, count)
    .join(" ");
}
