export type ChatCitation = {
  id: string;
  title: string;
  sourceUrl?: string;
  provider: string;
  sourceType: string;
};

export type ChatAnswerMode = "grounded" | "guardrail" | "no-context";

export type ChatAnswer = {
  teamSlug: string;
  answer: string;
  citations: ChatCitation[];
  confidence: "high" | "medium" | "low";
  // Provenance of the corpus only — which providers backed the answer and when
  // they were captured. Operational messages do not belong here; they go in
  // `notice`, so freshness stays a statement about sources.
  freshness: string;
  // Operational context about how the answer was produced: a provider failure,
  // or an answer that fell back to the deterministic composer. Absent on the
  // normal path.
  notice?: string;
  mode: ChatAnswerMode;
  provider: string;
  model: string;
};

export type ChatStreamEvent =
  | { type: "citations"; citations: ChatCitation[] }
  | { type: "delta"; text: string }
  | { type: "done"; answer: ChatAnswer };
