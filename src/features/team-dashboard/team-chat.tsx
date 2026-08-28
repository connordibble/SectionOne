"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowRight, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { readSseStream } from "@/lib/sse";
import styles from "./team-workspace.module.css";
import { safeExternalHref } from "@/lib/safe-url";

type ChatMode = "brief" | "matchup" | "schedule";

type TeamChatProps = {
  draftRequest?: DraftRequest;
  mode: ChatMode;
  starterRead: {
    question: string;
    answer: string;
    citations: ChatCitation[];
  };
  suggestedPrompts: string[];
  tagline: string;
  teamSlug: string;
};

export type DraftRequest = {
  id: number;
  value: string;
};

export type ChatCitation = {
  id: string;
  title: string;
  sourceUrl?: string;
  provider: string;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  freshness?: string;
  notice?: string;
  streaming: boolean;
  error?: string;
};

type ChatExchange = {
  question: ChatMessage;
  answer?: ChatMessage;
};

const maxHistorySent = 8;

const modeCopy: Record<Exclude<ChatMode, "matchup">, { heading: string; body: string }> = {
  brief: {
    heading: "Tune your signal",
    body: "Get the short answer before kickoff.",
  },
  schedule: {
    heading: "Ask the schedule",
    body: "Ask about dates, times, or the road ahead.",
  },
};

export function TeamChat({
  draftRequest,
  mode,
  starterRead,
  suggestedPrompts,
  tagline,
  teamSlug,
}: TeamChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [composerFocusRequest, setComposerFocusRequest] = useState(0);
  const nextId = useRef(0);
  const sessionId = useRef<string | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMessages = messages.length > 0;
  const exchanges = groupExchanges(messages);
  const sourceCount = countUniqueCitations(messages);

  useEffect(() => {
    const thread = threadRef.current;

    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!draftRequest) {
      return;
    }

    setInput(draftRequest.value);

    const input = inputRef.current;

    if (!input) {
      return;
    }

    // "Ask about this" is a jump, not a focus change. The composer sits in a
    // dock that is a sidebar on wide layouts and a band below the board on
    // narrow ones, so the button is usually pressed while the composer is off
    // screen — focus alone would leave the caret somewhere the fan cannot see.
    //
    // Focus is taken without the browser's own scroll so the whole control is
    // moved to, not just the caret. Whether to move is decided here rather
    // than with `block: "nearest"`, so an already-visible composer is left
    // exactly where it is and an off-screen one arrives centred instead of
    // wedged against the bottom edge, where a phone keyboard would cover it.
    //
    // The scroll is deliberately instant. `behavior: "smooth"` is not
    // dependable — under automation it can no-op entirely, which would turn
    // this into a focus change the fan never sees.
    input.focus({ preventScroll: true });

    const composer = input.closest("form");

    if (!composer) {
      return;
    }

    const box = composer.getBoundingClientRect();

    if (box.top < 0 || box.bottom > window.innerHeight) {
      composer.scrollIntoView({ block: "center" });
    }
  }, [draftRequest]);

  // The empty composer is replaced by a threaded composer after the first
  // question, and the threaded composer is replaced by the empty composer on
  // reset. Request focus after that new DOM node exists rather than before it
  // mounts, which otherwise leaves keyboard users at the document body.
  useEffect(() => {
    if (composerFocusRequest === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      setComposerFocusRequest(0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [composerFocusRequest, hasMessages]);

  function updateMessage(id: number, patch: (message: ChatMessage) => ChatMessage) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? patch(message) : message)),
    );
  }

  function resetConversation() {
    if (isLoading) {
      return;
    }

    setMessages([]);
    sessionId.current = undefined;
    setInput("");
    setComposerFocusRequest((current) => current + 1);
  }

  async function submit(message: string) {
    const trimmed = message.trim();

    if (!trimmed || isLoading) {
      return;
    }

    const history = messages
      .filter((entry) => !entry.error && entry.content)
      .slice(-maxHistorySent)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    const userId = nextId.current++;
    const assistantId = nextId.current++;

    setIsLoading(true);
    setInput("");
    setComposerFocusRequest((current) => current + 1);
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: trimmed, citations: [], streaming: false },
      { id: assistantId, role: "assistant", content: "", citations: [], streaming: true },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          teamSlug,
          message: trimmed,
          history,
          sessionId: sessionId.current,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          detail?.error ?? "We couldn’t answer that question. Check your connection and try again.",
        );
      }

      for await (const event of readSseStream(response.body)) {
        if (event.event === "citations") {
          const { citations } = JSON.parse(event.data) as { citations: ChatCitation[] };
          updateMessage(assistantId, (entry) => ({ ...entry, citations }));
        } else if (event.event === "delta") {
          const { text } = JSON.parse(event.data) as { text: string };
          updateMessage(assistantId, (entry) => ({ ...entry, content: entry.content + text }));
        } else if (event.event === "done") {
          const answer = JSON.parse(event.data) as {
            answer: string;
            citations: ChatCitation[];
            freshness: string;
            notice?: string;
            sessionId?: string;
          };
          if (answer.sessionId) {
            sessionId.current = answer.sessionId;
          }
          updateMessage(assistantId, (entry) => ({
            ...entry,
            content: answer.answer,
            citations: answer.citations,
            freshness: answer.freshness,
            notice: answer.notice,
            streaming: false,
          }));
        } else if (event.event === "error") {
          const { error } = JSON.parse(event.data) as { error: string };
          throw new Error(error);
        }
      }
    } catch (unknownError) {
      updateMessage(assistantId, (entry) => ({
        ...entry,
        streaming: false,
        error:
          unknownError instanceof Error
            ? unknownError.message
            : "We couldn’t answer that question. Try it again.",
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section aria-busy={isLoading} className={styles.chat} data-mode={mode}>
      {!hasMessages ? (
        <EmptyChat
          input={input}
          inputRef={inputRef}
          isLoading={isLoading}
          mode={mode}
          onInputChange={setInput}
          onPrompt={(prompt) => void submit(prompt)}
          onSubmit={(message) => void submit(message)}
          starterRead={starterRead}
          suggestedPrompts={suggestedPrompts}
          tagline={tagline}
        />
      ) : (
        <div className={styles.chatThreadShell}>
          <div className={styles.threadHeading}>
            <div>
              <h2>Your signal</h2>
              <p className={styles.threadSummary}>
                <span>
                  {exchanges.length} {exchanges.length === 1 ? "question" : "questions"}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {sourceCount > 0
                    ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"}`
                    : isLoading
                      ? "Checking sources"
                      : "No sources"}
                </span>
              </p>
            </div>
            <button
              className={styles.resetChat}
              disabled={isLoading}
              onClick={resetConversation}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              Start over
            </button>
          </div>
          <div aria-live="polite" className={styles.chatThread} ref={threadRef}>
            {exchanges.map((exchange, index) => (
              <article className={styles.chatExchange} key={exchange.question.id}>
                <header className={styles.userMessage}>
                  <span aria-hidden="true" className={`${styles.questionIndex} tnum`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{exchange.question.content}</p>
                </header>
                {exchange.answer ? <AssistantMessage message={exchange.answer} /> : null}
              </article>
            ))}
          </div>
          <ChatComposer
            input={input}
            inputRef={inputRef}
            isLoading={isLoading}
            mode={mode}
            onInputChange={setInput}
            onSubmit={(message) => void submit(message)}
            threaded
          />
        </div>
      )}
    </section>
  );
}

function EmptyChat({
  input,
  inputRef,
  isLoading,
  mode,
  onInputChange,
  onPrompt,
  onSubmit,
  starterRead,
  suggestedPrompts,
  tagline,
}: {
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  mode: ChatMode;
  onInputChange: (value: string) => void;
  onPrompt: (prompt: string) => void;
  onSubmit: (message: string) => void;
  starterRead: TeamChatProps["starterRead"];
  suggestedPrompts: string[];
  tagline: string;
}) {
  if (mode === "matchup") {
    return (
      <div className={styles.matchupRead}>
        <div className={styles.readAnswer}>
          <h2>The read</h2>
          <p className={styles.readQuestion}>{starterRead.question}</p>
          <p>{starterRead.answer}</p>
          {starterRead.citations.length > 0 ? (
            <CitationList citations={starterRead.citations} className={styles.starterCitations} />
          ) : null}
        </div>
        <ChatComposer
          input={input}
          inputRef={inputRef}
          isLoading={isLoading}
          mode={mode}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
        />
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <div className={styles.emptyChat}>
      <div className={styles.emptyChatHeading}>
        <h2>{copy.heading}</h2>
        <p>{mode === "brief" ? tagline : copy.body}</p>
      </div>
      <ChatComposer
        input={input}
        inputRef={inputRef}
        isLoading={isLoading}
        mode={mode}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
      />
      {mode === "brief" ? (
        <div className={styles.promptRail} data-testid="suggested-prompts">
          <p className={styles.promptLabel}>Quick questions</p>
          <div className={styles.promptList}>
            {suggestedPrompts.map((prompt, index) => (
              <button
                aria-label={prompt}
                disabled={isLoading}
                key={prompt}
                onClick={() => onPrompt(prompt)}
                type="button"
              >
                <span className={styles.promptIndex}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.promptText}>{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChatComposer({
  input,
  inputRef,
  isLoading,
  mode,
  onInputChange,
  onSubmit,
  threaded = false,
}: {
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  mode: ChatMode;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => void;
  threaded?: boolean;
}) {
  const placeholders: Record<ChatMode, string> = {
    brief: "What should I watch?",
    matchup: "Ask about this matchup",
    schedule: "Ask about the schedule",
  };

  return (
    <form
      className={`${styles.composer} ${threaded ? styles.threadComposer : ""}`}
      data-testid="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
    >
      {threaded ? (
        <span aria-hidden="true" className={styles.composerContext}>
          Follow up
        </span>
      ) : null}
      <input
        aria-label="Ask Section One"
        autoComplete="off"
        id="chat-input"
        onChange={(event) => onInputChange(event.target.value)}
        placeholder={placeholders[mode]}
        ref={inputRef}
        type="text"
        value={input}
      />
      <button
        disabled={isLoading || input.trim().length === 0}
        type="submit"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className={styles.spinner} />
        ) : (
          <ArrowRight aria-hidden="true" />
        )}
        <span>Ask</span>
      </button>
    </form>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const displayContent = stripCitationTags(message.content, message.citations);

  return (
    <section
      aria-label="Section One answer"
      className={styles.assistantMessage}
      data-has-evidence={message.citations.length > 0 ? "true" : undefined}
    >
      <div className={styles.answerBody}>
        <div className={styles.answerHeading}>
          <h3>The read</h3>
          {message.streaming && displayContent ? <span>Live</span> : null}
        </div>
        {displayContent ? (
          <p className={styles.answerText}>
            {displayContent}
            {message.streaming ? (
              <span
                aria-label="Answer is still arriving"
                className={styles.streamingMark}
                role="status"
              />
            ) : null}
          </p>
        ) : null}
        {message.streaming && !displayContent ? (
          <p className={styles.answerLoading} role="status">
            <span aria-hidden="true" className={styles.streamingMark} />
            Checking sources
          </p>
        ) : null}
        {message.error ? (
          <p className={styles.chatError} role="alert">
            {message.error}
          </p>
        ) : null}
      </div>
      {message.citations.length > 0 ? (
        <aside aria-label="Sources" className={styles.evidenceRail}>
          <div className={styles.evidenceHeading}>
            <h3>Sources</h3>
            <span className="tnum">{message.citations.length}</span>
          </div>
          <CitationList citations={message.citations} className={styles.citationList} />
        </aside>
      ) : null}
      {message.freshness || message.notice ? (
        <footer className={styles.answerFooter}>
          {message.freshness ? (
            <div className={styles.answerMeta}>
              <p>{message.freshness}</p>
            </div>
          ) : null}
          {message.notice ? <p className={styles.answerNotice}>{message.notice}</p> : null}
        </footer>
      ) : null}
    </section>
  );
}

function CitationList({
  citations,
  className,
}: {
  citations: ChatCitation[];
  className: string;
}) {
  return (
    <ol className={className}>
      {citations.map((citation) => (
        <li key={citation.id}>
          <CitationRow citation={citation} />
        </li>
      ))}
    </ol>
  );
}

function CitationRow({ citation }: { citation: ChatCitation }) {
  const content = (
    <>
      <span className={styles.citationTitle}>{citation.title}</span>
      <span className={styles.citationMeta}>
        {providerLabel(citation.provider)}
        {citation.sourceUrl ? (
          <>
            <ExternalLink aria-hidden="true" />
            <span className={styles.visuallyHidden}>Opens in a new tab</span>
          </>
        ) : null}
      </span>
    </>
  );

  // A citation whose URL is not an http(s) link is shown as text rather than
  // as a dead or dangerous link. Weekly items are already filtered at ingest;
  // this covers every other document producer feeding `sourceUrl`.
  const href = safeExternalHref(citation.sourceUrl);

  if (!href) {
    return <div className={styles.citationRow}>{content}</div>;
  }

  return (
    <a className={styles.citationRow} href={href} rel="noopener noreferrer" target="_blank">
      {content}
    </a>
  );
}

function groupExchanges(messages: ChatMessage[]): ChatExchange[] {
  const exchanges: ChatExchange[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      exchanges.push({ question: message });
      continue;
    }

    const current = exchanges.at(-1);
    if (current && !current.answer) {
      current.answer = message;
    }
  }

  return exchanges;
}

function countUniqueCitations(messages: ChatMessage[]): number {
  return new Set(
    messages.flatMap((message) =>
      message.citations.map((citation) => `${citation.provider}:${citation.id}`),
    ),
  ).size;
}

function stripCitationTags(content: string, citations: ChatCitation[]): string {
  const withoutTags = citations.reduce(
    (answer, citation) => answer.split(`[${citation.title}]`).join(""),
    content,
  );

  return withoutTags.replaceAll(/[ \t]+\n/g, "\n").replaceAll(/ {2,}/g, " ").trim();
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    fixture: "Section One",
    official: "Primary source",
    cfbd: "Season data",
    policy: "Section One",
  };

  return labels[provider] ?? "Source";
}
