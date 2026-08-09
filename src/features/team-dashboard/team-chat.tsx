"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowRight, ExternalLink, Loader2, RotateCcw, Send } from "lucide-react";
import { readSseStream } from "@/lib/sse";
import styles from "./team-workspace.module.css";

type ChatMode = "brief" | "matchup" | "schedule" | "sources";

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
  confidence?: string;
  freshness?: string;
  notice?: string;
  streaming: boolean;
  error?: string;
};

const maxHistorySent = 8;

const modeCopy: Record<Exclude<ChatMode, "matchup">, { heading: string; body: string }> = {
  brief: {
    heading: "Ask Saturday Signal",
    body: "Use the board’s cues, the schedule, or your own angle. The evidence stays attached.",
  },
  schedule: {
    heading: "Ask the schedule",
    body: "Compare stretches, kickoff windows, and opponent sequence without losing the dates.",
  },
  sources: {
    heading: "Ask the evidence",
    body: "Trace a claim to the record, or find the places where the record is still thin.",
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
  const nextId = useRef(0);
  const sessionId = useRef<string | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMessages = messages.length > 0;

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
    inputRef.current?.focus({ preventScroll: true });
  }, [draftRequest]);

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
    inputRef.current?.focus({ preventScroll: true });
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
          detail?.error ?? "That answer did not arrive. Check your connection and try again.",
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
            confidence: string;
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
            confidence: answer.confidence,
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
            : "That answer did not arrive. Try the question again.",
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
              <h2>The thread</h2>
              <p>Grounded answers stay together as you move between views.</p>
            </div>
            <button
              className={styles.resetChat}
              disabled={isLoading}
              onClick={resetConversation}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              New thread
            </button>
          </div>
          <div aria-live="polite" className={styles.chatThread} ref={threadRef}>
            {messages.map((message) =>
              message.role === "user" ? (
                <div className={styles.userMessage} key={message.id}>
                  <p>{message.content}</p>
                </div>
              ) : (
                <AssistantMessage key={message.id} message={message} />
              ),
            )}
          </div>
          <ChatComposer
            input={input}
            inputRef={inputRef}
            isLoading={isLoading}
            mode={mode}
            onInputChange={setInput}
            onSubmit={(message) => void submit(message)}
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
            <div className={styles.starterCitations}>
              {starterRead.citations.map((citation) => (
                <CitationRow citation={citation} key={citation.id} />
              ))}
            </div>
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
        <div className={styles.promptList} data-testid="suggested-prompts">
          {suggestedPrompts.map((prompt) => (
            <button
              disabled={isLoading}
              key={prompt}
              onClick={() => onPrompt(prompt)}
              type="button"
            >
              <span>{prompt}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
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
}: {
  input: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isLoading: boolean;
  mode: ChatMode;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => void;
}) {
  const placeholders: Record<ChatMode, string> = {
    brief: "What do you want to know?",
    matchup: "Ask about this matchup",
    schedule: "Ask about the schedule",
    sources: "Trace a claim to its source",
  };

  return (
    <form
      className={styles.composer}
      data-testid="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(input);
      }}
    >
      <label className={styles.visuallyHidden} htmlFor="chat-input">
        Ask Saturday Signal
      </label>
      <input
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
          <Send aria-hidden="true" />
        )}
        <span>Ask</span>
      </button>
    </form>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <section className={styles.assistantMessage}>
      {message.content || !message.error ? (
        <p className={styles.answerText}>
          {message.content}
          {message.streaming ? (
            <span
              aria-label="Answer is still arriving"
              className={styles.streamingMark}
              role="status"
            />
          ) : null}
        </p>
      ) : null}
      {message.error ? (
        <p className={styles.chatError} role="alert">
          {message.error}
        </p>
      ) : null}
      {message.citations.length > 0 ? (
        <div className={styles.citationList}>
          {message.citations.map((citation) => (
            <CitationRow citation={citation} key={citation.id} />
          ))}
        </div>
      ) : null}
      {message.confidence || message.freshness ? (
        <p className={styles.answerMeta}>
          {message.confidence ? <strong>{message.confidence} confidence</strong> : null}
          {message.confidence && message.freshness ? " · " : null}
          {message.freshness}
        </p>
      ) : null}
      {message.notice ? <p className={styles.answerNotice}>{message.notice}</p> : null}
    </section>
  );
}

function CitationRow({ citation }: { citation: ChatCitation }) {
  const content = (
    <>
      <span>{citation.title}</span>
      <span className={styles.citationMeta}>
        {providerLabel(citation.provider)}
        {citation.sourceUrl ? <ExternalLink aria-hidden="true" /> : null}
      </span>
    </>
  );

  if (!citation.sourceUrl) {
    return <div className={styles.citationRow}>{content}</div>;
  }

  return (
    <a
      className={styles.citationRow}
      href={citation.sourceUrl}
      rel="noreferrer"
      target="_blank"
    >
      {content}
    </a>
  );
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    fixture: "Saturday Signal",
    official: "Primary source",
    cfbd: "Season data",
    policy: "Source policy",
  };

  return labels[provider] ?? "Source record";
}
