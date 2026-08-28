import { getSharedDb, type Db } from "@/server/db/client";
import { answerCitations, chatMessages, chatSessions } from "@/server/db/schema";
import type { ChatAnswer } from "./types";
import { reportDegradation } from "@/server/observability/report";

export type ChatExchange = {
  question: string;
  answer: ChatAnswer;
  sessionId?: string;
};

export type PersistedExchange = { sessionId: string };

// Best-effort chat history persistence. Without DATABASE_URL this is a no-op;
// with it, each exchange lands in chat_sessions/chat_messages and citations in
// answer_citations. Failures are logged and swallowed — persistence must never
// take the chat surface down.
export async function persistChatExchange(
  exchange: ChatExchange,
  dbOverride?: Db,
): Promise<PersistedExchange | null> {
  const db = dbOverride ?? getSharedDb();

  if (!db) {
    return null;
  }

  try {
    const sessionId = exchange.sessionId ?? (await createSession(db, exchange.answer.teamSlug));

    await db.insert(chatMessages).values([
      {
        chatSessionId: sessionId,
        role: "user",
        content: exchange.question,
      },
      {
        chatSessionId: sessionId,
        role: "assistant",
        content: exchange.answer.answer,
        provider: exchange.answer.provider,
        model: exchange.answer.model,
        mode: exchange.answer.mode,
      },
    ]);

    await persistCitations(db, sessionId, exchange.answer);

    return { sessionId };
  } catch (error) {
    reportDegradation(`persistence skipped: ${error instanceof Error ? error.message : String(error)}`, {
      scope: "chat/persistence",
      fingerprint: "chat/persistence:exchange",
    });
    return null;
  }
}

async function createSession(db: Db, teamSlug: string): Promise<string> {
  const rows = await db
    .insert(chatSessions)
    .values({ teamSlug })
    .returning({ id: chatSessions.id });

  return rows[0].id;
}

async function persistCitations(db: Db, sessionId: string, answer: ChatAnswer): Promise<void> {
  if (answer.citations.length === 0) {
    return;
  }

  try {
    await db.insert(answerCitations).values(
      answer.citations.map((citation) => ({
        chatSessionId: sessionId,
        sourceDocumentId: citation.id,
        quote: citation.title,
        sourceUrl: citation.sourceUrl,
      })),
    );
  } catch (error) {
    // Citation rows reference seeded source documents; an unseeded database
    // should still keep the message history.
    reportDegradation(`citation persistence skipped: ${error instanceof Error ? error.message : String(error)}`, {
      scope: "chat/persistence",
      fingerprint: "chat/persistence:citations",
    });
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
