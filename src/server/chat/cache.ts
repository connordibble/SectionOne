import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getSharedDb } from "@/server/db/client";
import { chatAnswerCache } from "@/server/db/schema";
import { resolveEmbeddingProvider } from "@/server/embeddings/registry";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { getPollWeek } from "@/server/sources/rankings";
import { getWeeklyEdition } from "@/server/sources/weekly";
import { runAfterResponse } from "@/server/http/after-response";
import { reportDegradation } from "@/server/observability/report";
import type { PublicChatAnswer } from "./types";

// How close two questions must be before one's answer is reused.
//
// Calibration matters more here than anywhere else in the cache. With a real
// embedding model, genuine rephrasings of the same question land around
// 0.93-0.98; two *different* questions about the same team land as high as
// 0.85 because they share a vocabulary. "What should I watch on early downs?"
// and "...on special teams?" are close neighbours with completely different
// correct answers.
//
// 0.97 is deliberately past the paraphrase band's midpoint. It gives up hits
// on loose rewordings to make a wrong hit very unlikely, which is the right
// trade for a product whose credibility is the thing being cached. Anything
// below about 0.93 would start returning confident answers to questions nobody
// asked.
const defaultSimilarity = 0.97;

// Independent of corpus changes, so a team whose sources sat still does not
// serve month-old answers.
const defaultTtlDays = 7;

export type CacheEnv = Record<string, string | undefined>;

export function resolveSimilarityThreshold(env: CacheEnv = process.env): number {
  const parsed = Number(env.CHAT_CACHE_SIMILARITY);

  // Clamped at the bottom: a misconfigured 0.5 would be worse than no cache,
  // and this is not a knob worth trusting to a typo.
  if (!Number.isFinite(parsed) || parsed < 0.9 || parsed > 1) {
    return defaultSimilarity;
  }

  return parsed;
}

export function cacheEnabled(env: CacheEnv = process.env): boolean {
  return env.CHAT_CACHE !== "off";
}

// Identifies the exact source material an answer was built from.
//
// Everything that can change what a correct answer looks like goes in: the
// weekly package, the schedule capture, and the poll week. When any of them
// moves, every existing row for the team stops matching and the next asker
// gets a fresh answer rather than a confident stale one.
export function corpusVersion(teamSlug: string): string {
  const schedule = getTeamSchedule(teamSlug);
  const weekly = getWeeklyEdition(teamSlug);
  const poll = schedule ? getPollWeek(schedule.seasonYear) : undefined;

  return createHash("sha256")
    .update(
      [
        teamSlug,
        schedule?.capturedAt ?? "no-schedule",
        weekly?.publishedAt ?? "no-weekly",
        poll?.capturedAt ?? "no-poll",
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 16);
}

// Folds away the differences that never change an answer. Punctuation, case,
// and filler only — nothing that could merge two genuinely different asks.
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type CacheLookup =
  | { hit: true; answer: PublicChatAnswer; via: "exact" | "semantic" }
  | { hit: false };

// Never throws and never blocks an answer. A cache that can take chat down is
// a liability, so every failure path here degrades to "generate it fresh".
export async function lookupCachedAnswer(
  teamSlug: string,
  question: string,
  env: CacheEnv = process.env,
): Promise<CacheLookup> {
  if (!cacheEnabled(env)) {
    return { hit: false };
  }

  const db = getSharedDb();

  if (!db) {
    return { hit: false };
  }

  const version = corpusVersion(teamSlug);
  const normalized = normalizeQuestion(question);
  const ttlDays = defaultTtlDays;

  try {
    const [exact] = await db
      .select({ id: chatAnswerCache.id, answer: chatAnswerCache.answer })
      .from(chatAnswerCache)
      .where(
        and(
          eq(chatAnswerCache.teamSlug, teamSlug),
          eq(chatAnswerCache.corpusVersion, version),
          eq(chatAnswerCache.questionNormalized, normalized),
          sql`${chatAnswerCache.createdAt} > now() - make_interval(days => ${ttlDays})`,
        ),
      )
      .limit(1);

    if (exact) {
      runAfterResponse(() => recordHit(exact.id), "chat/cache:hit");

      return { hit: true, answer: exact.answer as PublicChatAnswer, via: "exact" };
    }

    return await lookupSemantic(teamSlug, question, version, ttlDays, env);
  } catch (error) {
    reportDegradation(
      `cache lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      { scope: "chat/cache", fingerprint: "chat/cache:lookup" },
    );

    return { hit: false };
  }
}

// Gated on a real embedding provider. The offline embedder is a deterministic
// hash, so cosine similarity between its vectors carries no meaning — running
// this against it would either never hit or, worse, hit for the wrong reason.
async function lookupSemantic(
  teamSlug: string,
  question: string,
  version: string,
  ttlDays: number,
  env: CacheEnv,
): Promise<CacheLookup> {
  const { provider: embeddings } = resolveEmbeddingProvider(env);

  if (embeddings.name === "mock") {
    return { hit: false };
  }

  const db = getSharedDb();

  if (!db) {
    return { hit: false };
  }

  const [vector] = await embeddings.embed([question]);

  if (!vector) {
    return { hit: false };
  }

  const threshold = resolveSimilarityThreshold(env);
  const vectorParam = `[${vector.join(",")}]`;
  const similarity = sql<number>`1 - (${chatAnswerCache.questionEmbedding} <=> ${vectorParam}::vector)`;

  const [match] = await db
    .select({ id: chatAnswerCache.id, answer: chatAnswerCache.answer, similarity })
    .from(chatAnswerCache)
    .where(
      and(
        eq(chatAnswerCache.teamSlug, teamSlug),
        eq(chatAnswerCache.corpusVersion, version),
        sql`${chatAnswerCache.questionEmbedding} IS NOT NULL`,
        sql`${chatAnswerCache.createdAt} > now() - make_interval(days => ${ttlDays})`,
        sql`1 - (${chatAnswerCache.questionEmbedding} <=> ${vectorParam}::vector) >= ${threshold}`,
      ),
    )
    .orderBy(sql`${chatAnswerCache.questionEmbedding} <=> ${vectorParam}::vector`)
    .limit(1);

  if (!match) {
    return { hit: false };
  }

  runAfterResponse(() => recordHit(match.id), "chat/cache:hit");

  return { hit: true, answer: match.answer as PublicChatAnswer, via: "semantic" };
}

// Only escalated, accepted answers are worth storing. A composer answer is
// already free and deterministic; a guardrail or no-context reply is
// situational; and an answer that fell back after failing the acceptance gate
// is not the answer we want to serve twice.
export async function storeCachedAnswer(
  teamSlug: string,
  question: string,
  answer: PublicChatAnswer,
  env: CacheEnv = process.env,
): Promise<void> {
  if (!cacheEnabled(env) || answer.mode !== "grounded" || answer.notice) {
    return;
  }

  const db = getSharedDb();

  if (!db) {
    return;
  }

  try {
    const { provider: embeddings } = resolveEmbeddingProvider(env);
    const vector =
      embeddings.name === "mock" ? null : (await embeddings.embed([question]))[0] ?? null;

    await db
      .insert(chatAnswerCache)
      .values({
        teamSlug,
        questionNormalized: normalizeQuestion(question),
        questionEmbedding: vector,
        corpusVersion: corpusVersion(teamSlug),
        answer,
      })
      .onConflictDoNothing();
  } catch (error) {
    reportDegradation(
      `cache write failed: ${error instanceof Error ? error.message : String(error)}`,
      { scope: "chat/cache", fingerprint: "chat/cache:write" },
    );
  }
}

async function recordHit(id: string): Promise<void> {
  const db = getSharedDb();

  if (!db) {
    return;
  }

  try {
    await db
      .update(chatAnswerCache)
      .set({ hitCount: sql`${chatAnswerCache.hitCount} + 1`, lastHitAt: new Date() })
      .where(eq(chatAnswerCache.id, id));
  } catch {
    // A missed counter is not worth a log line on every hit.
  }
}
