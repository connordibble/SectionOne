export type ChatCitation = {
  id: string;
  title: string;
  sourceUrl?: string;
  provider: string;
  sourceType: string;
};

export type ChatAnswerMode = "grounded" | "guardrail" | "no-context";

export type ChatFreshness = {
  coverage: string;
  schedule: string;
  context?: string;
  search?: string;
};

// Removed: `confidence`. It was derived from how many citations an answer
// carried, which measures the corpus rather than the answer, so a reply saying
// "there is no clear read on this yet" reported "high" for having two sources
// under it. Nothing rendered it — a test asserts the reader never sees the word
// — so it was a wrong number with no reader, exported publicly where a consumer
// could have trusted it. Freshness and `mode` carry the honest signals.
export type ChatAnswer = {
  teamSlug: string;
  answer: string;
  citations: ChatCitation[];
  // Provenance of the corpus only — which providers backed the answer and when
  // they were captured. Operational messages do not belong here; they go in
  // `notice`, so freshness stays a statement about sources.
  freshness: ChatFreshness;
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
    freshness: answer.freshness,
    notice: answer.notice,
    mode: answer.mode,
  };
}

export type ChatStreamEvent =
  | { type: "citations"; citations: ChatCitation[] }
  | { type: "delta"; text: string }
  | { type: "done"; answer: ChatAnswer };
