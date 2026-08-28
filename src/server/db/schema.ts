import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
});

export const teams = pgTable("teams", {
  slug: text("slug").primaryKey(),
  displayName: text("display_name").notNull(),
  sport: text("sport").notNull(),
  conference: text("conference").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamSlug: text("team_slug")
      .notNull()
      .references(() => teams.slug),
    year: integer("year").notNull(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.teamSlug, table.year)],
);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    teamSlug: text("team_slug")
      .notNull()
      .references(() => teams.slug),
    seasonYear: integer("season_year").notNull(),
    opponent: text("opponent").notNull(),
    site: text("site").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    venue: text("venue"),
    tv: text("tv"),
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("games_team_season_idx").on(table.teamSlug, table.seasonYear)],
);

export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: text("id").primaryKey(),
    teamSlug: text("team_slug")
      .notNull()
      .references(() => teams.slug),
    provider: text("provider").notNull(),
    sourceType: text("source_type").notNull(),
    sourceUrl: text("source_url"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("source_documents_team_provider_idx").on(table.teamSlug, table.provider)],
);

export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: text("id").primaryKey(),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenEstimate: integer("token_estimate").notNull(),
    embedding: vector("embedding"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("source_chunks_document_idx").on(table.sourceDocumentId),
    index("source_chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamSlug: text("team_slug")
    .notNull()
    .references(() => teams.slug),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatSessionId: uuid("chat_session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    provider: text("provider"),
    model: text("model"),
    // Kept as a column, no longer written. The value it held was derived from
    // citation count rather than from certainty, so the history is not worth
    // reading; dropping it is a migration that can wait for one that matters.
    confidence: text("confidence"),
    mode: text("mode"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_messages_session_idx").on(table.chatSessionId, table.createdAt)],
);

// Attribution ledger for paid model calls. See drizzle/0002_llm_usage.sql for
// why team_slug carries no foreign key and why cost_usd is nullable.
export const llmUsage = pgTable(
  "llm_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamSlug: text("team_slug").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    accepted: boolean("accepted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("llm_usage_created_at_idx").on(table.createdAt),
    index("llm_usage_team_created_idx").on(table.teamSlug, table.createdAt),
  ],
);

export const answerCitations = pgTable("answer_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatSessionId: uuid("chat_session_id").references(() => chatSessions.id, {
    onDelete: "cascade",
  }),
  sourceDocumentId: text("source_document_id").references(() => sourceDocuments.id),
  quote: text("quote"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Which programs fans want covered. See drizzle/0003_team_requests.sql for why
// the raw entry is kept alongside a normalized form, and why nothing
// identifying beyond an optional email is stored.
export const teamRequests = pgTable(
  "team_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamName: text("team_name").notNull(),
    teamNameNormalized: text("team_name_normalized").notNull(),
    email: text("email"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("team_requests_normalized_idx").on(table.teamNameNormalized),
    index("team_requests_created_at_idx").on(table.createdAt),
  ],
);

// Answers already produced for a question someone else asked. See
// drizzle/0004_chat_answer_cache.sql for why corpus_version is the safety
// mechanism rather than an optimisation.
export const chatAnswerCache = pgTable(
  "chat_answer_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamSlug: text("team_slug").notNull(),
    questionNormalized: text("question_normalized").notNull(),
    // Null unless a real embedding provider is configured; the offline
    // embedder is a hash and its similarity carries no meaning.
    questionEmbedding: vector("question_embedding"),
    corpusVersion: text("corpus_version").notNull(),
    answer: jsonb("answer").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
  },
  (table) => [
    unique("chat_answer_cache_exact_idx").on(
      table.teamSlug,
      table.corpusVersion,
      table.questionNormalized,
    ),
    index("chat_answer_cache_created_at_idx").on(table.createdAt),
  ],
);

export const schema = {
  teams,
  seasons,
  games,
  sourceDocuments,
  sourceChunks,
  chatSessions,
  chatMessages,
  answerCitations,
  llmUsage,
  teamRequests,
  chatAnswerCache,
};

export const vectorExtensionSql = sql`CREATE EXTENSION IF NOT EXISTS vector`;
