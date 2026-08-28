import { getTeamConfig } from "@/config/team";
import { answerQuestion, streamAnswerEvents } from "@/server/chat/answer";
import { isUuid, persistChatExchange } from "@/server/chat/persistence";
import { maxMessageLength, type ChatHistoryMessage } from "@/server/chat/prompt";
import { toPublicAnswer, type ChatStreamEvent } from "@/server/chat/types";
import { withRouteErrors } from "@/server/observability/route";
import { checkRateLimit, rateLimitResponse } from "@/server/http/rate-limit";

export const runtime = "nodejs";

type ChatRequest = {
  message?: string;
  teamSlug?: string;
  history?: unknown;
  sessionId?: unknown;
};

// The endpoint that spends money, so it gets the tightest limit.
//
// Ten a minute is a question every six seconds, sustained. Nobody reading a
// briefing does that, and the composer blocks submission while an answer is
// streaming, so one session cannot reach it without deliberately trying. It
// was twenty; the argument for the smaller number is simply that the gap
// between real use and the ceiling was never doing any work.
//
// The one case to watch is a shared address — campus wifi or carrier NAT,
// which is a plausible way to reach a college football audience — where the
// per-IP budget is split across everyone behind it. A limit hit logs
// `http/rate-limit:chat`, so that shows up as a pattern rather than a mystery.
const chatRateLimit = { name: "chat", windowMs: 60_000, max: 10 };

export const POST = withRouteErrors("api/chat", async (request: Request) => {
  const limit = checkRateLimit(request, chatRateLimit);

  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequest;

  if (!body.message?.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  if (body.message.length > maxMessageLength) {
    return Response.json(
      { error: `message must be at most ${maxMessageLength} characters` },
      { status: 400 },
    );
  }

  if (body.teamSlug && !getTeamConfig(body.teamSlug)) {
    return Response.json({ error: `Unknown team slug: ${body.teamSlug}` }, { status: 404 });
  }

  const history = parseHistory(body.history);

  if (history === null) {
    return Response.json(
      { error: "history must be an array of { role: 'user' | 'assistant', content: string }" },
      { status: 400 },
    );
  }

  if (body.sessionId !== undefined && (typeof body.sessionId !== "string" || !isUuid(body.sessionId))) {
    return Response.json({ error: "sessionId must be a UUID" }, { status: 400 });
  }

  const message = body.message;
  const sessionId = body.sessionId as string | undefined;

  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return streamResponse(message, body.teamSlug, history, sessionId);
  }

  const answer = await answerQuestion(message, body.teamSlug, { history });
  const persisted = await persistChatExchange({ question: message, answer, sessionId });

  return Response.json({ ...toPublicAnswer(answer), sessionId: persisted?.sessionId });
});

function streamResponse(
  message: string,
  teamSlug: string | undefined,
  history: ChatHistoryMessage[],
  sessionId: string | undefined,
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamAnswerEvents(message, teamSlug, { history })) {
          if (event.type === "done") {
            const persisted = await persistChatExchange({
              question: message,
              answer: event.answer,
              sessionId,
            });
            controller.enqueue(
              encoder.encode(
                `event: done\ndata: ${JSON.stringify({ ...toPublicAnswer(event.answer), sessionId: persisted?.sessionId })}\n\n`,
              ),
            );
          } else {
            controller.enqueue(encoder.encode(encodeSseEvent(event)));
          }
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "stream failed";
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ error: detail })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function encodeSseEvent(event: ChatStreamEvent): string {
  switch (event.type) {
    case "citations":
      return `event: citations\ndata: ${JSON.stringify({ citations: event.citations })}\n\n`;
    case "delta":
      return `event: delta\ndata: ${JSON.stringify({ text: event.text })}\n\n`;
    case "done":
      return `event: done\ndata: ${JSON.stringify(toPublicAnswer(event.answer))}\n\n`;
  }
}

function parseHistory(value: unknown): ChatHistoryMessage[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const history: ChatHistoryMessage[] = [];

  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("role" in entry) ||
      !("content" in entry)
    ) {
      return null;
    }

    const { role, content } = entry as { role: unknown; content: unknown };

    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null;
    }

    history.push({ role, content });
  }

  return history;
}
