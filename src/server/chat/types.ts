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
  // Which provider and model produced this. Internal only: the ledger and
  // persistence need it, and nothing outside the server should see it.
  provider: string;
  model: string;
};

// What actually goes over the wire.
//
// Which model writes an answer is an implementation detail a fan has no reason
// to care about, and naming it publicly both advertises a target and commits
// us to a disclosure we would have to keep updating every time it changes.
// `mode` stays, because "grounded" versus "guardrail" is about the answer
// rather than about the machinery.
export type PublicChatAnswer = Omit<ChatAnswer, "provider" | "model">;

export function toPublicAnswer(answer: ChatAnswer): PublicChatAnswer {
  // Rebuilt field by field rather than destructured, so adding an internal
  // field to ChatAnswer cannot leak it by default. A new field has to be
  // listed here to reach a fan.
  return {
    teamSlug: answer.teamSlug,
    answer: answer.answer,
    citations: answer.citations,
    confidence: answer.confidence,
    freshness: answer.freshness,
    notice: answer.notice,
    mode: answer.mode,
  };
}

export type ChatStreamEvent =
  | { type: "citations"; citations: ChatCitation[] }
  | { type: "delta"; text: string }
  | { type: "done"; answer: ChatAnswer };
