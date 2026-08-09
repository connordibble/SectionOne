// Environment shape accepted by provider factories. Looser than
// NodeJS.ProcessEnv on purpose so callers and tests can pass plain objects.
export type LlmEnv = Record<string, string | undefined>;

export type LlmRole = "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

// What the deterministic composer can answer without a live model. Routing
// escalates to a paid provider for anything not on this list, so adding a
// member here is a promise that mock.ts has a real branch for it and that
// prompt.ts populates the facts it needs.
export type ComposerCapability =
  | "next-game-brief"
  | "schedule"
  | "source-readiness"
  | "team-note-brief";

export type ScheduleGameFact = {
  opponent: string;
  site: "home" | "away" | "neutral";
  dateLabel: string;
  kickoff: string;
  venue: string;
  tv: string | null;
};

export type SourceReadinessFact = {
  label: string;
  state: "Ready" | "Planned" | "Needs key";
};

// Structured facts the chat layer derived from retrieval and team config.
// Real LLM providers answer from `system` + `messages` alone and ignore this;
// the mock provider uses it to compose deterministic grounded answers so the
// app works end-to-end without any API key.
export type GroundingContext = {
  teamName: string;
  teamDisplayName: string;
  seasonYear?: number;
  // Set when routing chose the composer; undefined means the request was
  // escalated and no deterministic template applies.
  capability?: ComposerCapability;
  nextGame?: ScheduleGameFact;
  upcomingGames: ScheduleGameFact[];
  sourceReadiness: SourceReadinessFact[];
  scheduleCapturedAt?: string;
  excerpts: Array<{ title: string; content: string }>;
  citationTitles: string[];
};

export type LlmRequest = {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  grounding?: GroundingContext;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  // The model the provider actually billed, not the alias that was requested.
  model: string;
};

export type LlmResult = {
  text: string;
  model: string;
  // Absent for providers that bill nothing (the deterministic composer) or
  // that do not report token counts.
  usage?: LlmUsage;
};

export type LlmProvider = {
  readonly name: string;
  readonly model: string;
  generate(request: LlmRequest): Promise<LlmResult>;
  stream(request: LlmRequest): AsyncGenerator<string, void, void>;
};

export class LlmProviderError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${provider}] ${message}`, options);
    this.name = "LlmProviderError";
  }
}
