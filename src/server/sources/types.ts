// "press" is reporting published by an outlet and summarised here under its own
// byline and link. It stays separate from "fixture" so retrieval, the chat
// citation list, and any future ledger can always tell our own editorial work
// apart from someone else's reporting.
export type SourceProvider = "fixture" | "cfbd" | "official" | "press";
export type SourceType = "schedule" | "game" | "news" | "team-note" | "ranking";

export type SourceDocument = {
  id: string;
  teamSlug: string;
  provider: SourceProvider;
  sourceType: SourceType;
  sourceUrl?: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  publishedAt?: string;
  fetchedAt: string;
};

export type IngestResult = {
  teamSlug: string;
  documents: SourceDocument[];
  counts: Record<SourceProvider, number>;
  warnings: string[];
};
