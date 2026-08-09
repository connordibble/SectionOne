"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { readSseStream } from "@/lib/sse";

type TeamChatProps = {
  compactTagline: string;
  teamSlug: string;
  suggestedPrompts: string[];
  tagline: string;
};

type ChatCitation = {
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

export function TeamChat({
  compactTagline,
  teamSlug,
  suggestedPrompts,
  tagline,
}: TeamChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const nextId = useRef(0);
  const sessionId = useRef<string | undefined>(undefined);
  const threadRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    const thread = threadRef.current;

    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages]);

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
        throw new Error(detail?.error ?? "Saturday Signal could not answer that yet.");
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
          unknownError instanceof Error ? unknownError.message : "Unknown chat error.",
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {!hasMessages ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 [grid-template-areas:'intro'_'composer'_'prompts'] lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)] lg:items-start lg:[grid-template-areas:'intro_prompts'_'composer_prompts']">
          <div className="min-w-0 [grid-area:intro]">
            {/* Subordinate to the kickoff lead on purpose. Stat-Led puts one
                figure at the top and everything below supports it; a second
                display-scale headline here would split the page's focus. */}
            <h2 className="max-w-[26ch] text-[length:var(--text-xl)] font-semibold leading-[1.2] tracking-tight text-balance text-[var(--team-ink)]">
              <span className="sm:hidden">{compactTagline}</span>
              <span className="hidden sm:inline">{tagline}</span>
            </h2>
            <p className="mt-3 max-w-[58ch] text-[length:var(--text-md)] leading-7 text-[var(--team-muted)]">
              Ask for matchup context, schedule reads, and source-backed football
              notes. Every answer names its evidence and stays inside the lane.
            </p>
          </div>
          <ChatComposer
            className="min-w-0 [grid-area:composer] lg:self-end"
            hasMessages={false}
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={(message) => submit(message)}
          />
          <PromptButtons
            className="grid min-w-0 gap-px [grid-area:prompts]"
            disabled={isLoading}
            onSelect={(prompt) => submit(prompt)}
            prompts={suggestedPrompts}
            testId="suggested-prompts"
          />
        </div>
      ) : (
        // Once there is a conversation, the whole workspace narrows to a
        // reading measure. The answer is running prose, not dashboard data,
        // and it should not inherit the width of a fixture table.
        <div className="flex min-h-0 w-full max-w-[var(--measure)] flex-col gap-4">
          <div className="flex items-center justify-end">
            <button
              className="inline-flex items-center gap-2 rounded-[var(--radius-input)] px-2 py-1.5 text-[length:var(--text-xs)] font-medium text-[var(--team-muted)] transition-colors duration-[var(--dur-short)] ease-[var(--ease-out)] hover:text-[var(--team-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={resetConversation}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={13} />
              New conversation
            </button>
          </div>
          <div
            aria-live="polite"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
            ref={threadRef}
          >
            {messages.map((message) =>
              message.role === "user" ? (
                <div className="flex justify-end" key={message.id}>
                  <p className="max-w-[85%] rounded-[var(--radius-card)] bg-[var(--team-accent)] px-3.5 py-2 text-[length:var(--text-sm)] leading-6 text-[var(--team-contrast)]">
                    {message.content}
                  </p>
                </div>
              ) : (
                <AssistantMessage key={message.id} message={message} />
              ),
            )}
          </div>
          <ChatComposer
            hasMessages
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSubmit={(message) => submit(message)}
          />
        </div>
      )}
    </div>
  );
}

function PromptButtons({
  className,
  disabled,
  onSelect,
  prompts,
  testId,
}: {
  className: string;
  disabled: boolean;
  onSelect: (prompt: string) => void;
  prompts: string[];
  testId: string;
}) {
  return (
    <div className={className} data-testid={testId}>
      {prompts.map((prompt) => (
        // Full prompt text, never truncated. The previous build clipped these
        // to one line with an ellipsis ("What should Texas fans watch on ear…"),
        // which turns a question the reader is meant to choose into one they
        // have to guess at. Rows rather than tiles for the same reason a menu
        // is a list: they are read, not scanned for shape.
        <button
          className="group -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 rounded-[var(--radius-input)] border-b border-[var(--team-border)] px-2 py-3 text-left text-[length:var(--text-sm)] font-medium leading-6 text-[var(--team-ink-subtle)] transition-colors duration-[var(--dur-short)] ease-[var(--ease-out)] last:border-b-0 hover:bg-[var(--team-surface-soft)] hover:text-[var(--team-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          key={prompt}
          onClick={() => onSelect(prompt)}
          type="button"
        >
          <span className="min-w-0">{prompt}</span>
          <span
            aria-hidden="true"
            className="text-[var(--team-border-strong)] transition-colors duration-[var(--dur-short)] ease-[var(--ease-out)] group-hover:text-[var(--team-accent)]"
          >
            →
          </span>
        </button>
      ))}
    </div>
  );
}

function ChatComposer({
  className,
  hasMessages,
  input,
  isLoading,
  onInputChange,
  onSubmit,
}: {
  className?: string;
  hasMessages: boolean;
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => void;
}) {
  return (
    <form
      className={`${className ?? ""} ${hasMessages ? "mt-auto" : ""} flex flex-col gap-3 border-t border-[var(--team-border)] pt-4 sm:flex-row`}
      data-testid="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(input);
      }}
    >
      <label className="sr-only" htmlFor="chat-input">
        Ask Saturday Signal
      </label>
      <input
        className="min-h-12 flex-1 rounded-[var(--radius-input)] border border-[var(--team-border-strong)] bg-[var(--team-contrast)] px-4 text-[length:var(--text-md)] text-[var(--team-ink)] outline-none transition-[background-color,border-color,box-shadow] duration-[var(--dur-short)] ease-[var(--ease-out)] placeholder:text-[var(--team-muted)] hover:bg-[var(--team-surface)] focus:border-[var(--team-accent)] focus:ring-2 focus:ring-[var(--team-accent-soft)]"
        id="chat-input"
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="Ask a football question..."
        type="text"
        value={input}
      />
      <button
        className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-input)] bg-[var(--team-accent)] px-5 text-[length:var(--text-sm)] font-semibold text-[var(--team-contrast)] transition-[background-color,transform] duration-[var(--dur-short)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:bg-[var(--team-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        disabled={isLoading}
        type="submit"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={17} />
        ) : (
          <Activity aria-hidden="true" size={17} />
        )}
        Ask Saturday Signal
      </button>
    </form>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    // A rule, not a box. The answer is the page's main body copy at this
    // point, so it gets body-copy treatment; the accent rule marks it as
    // sourced without wrapping it in card chrome.
    //
    // DOM order is the reading order on purpose: answer, then evidence, then
    // metadata. The previous build led with an uppercase confidence/freshness
    // strip, which put the least important line first for every reader and
    // first in the accessibility tree for screen readers.
    <section className="border-l-2 border-[var(--team-accent-soft)] pl-4">
      {message.content || !message.error ? (
        <p className="whitespace-pre-wrap text-[length:var(--text-md)] leading-7 text-[var(--team-ink)]">
          {message.content}
          {message.streaming ? (
            <span
              aria-hidden="true"
              className="ml-1 inline-block h-4 w-[3px] animate-pulse rounded-sm bg-[var(--team-accent)] align-text-bottom"
            />
          ) : null}
        </p>
      ) : null}
      {message.error ? (
        <p className="mt-2 text-[length:var(--text-sm)] font-medium leading-6 text-[var(--team-accent-strong)]">
          {message.error}
        </p>
      ) : null}
      {message.citations.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          {message.citations.map((citation) => (
            <CitationRow citation={citation} key={citation.id} />
          ))}
        </div>
      ) : null}
      {message.confidence || message.freshness ? (
        <p className="mt-3 text-[length:var(--text-xs)] leading-5 text-[var(--team-muted)]">
          {message.confidence ? (
            <span className="font-medium text-[var(--team-ink-subtle)]">
              {message.confidence} confidence
            </span>
          ) : null}
          {message.confidence && message.freshness ? " · " : null}
          {message.freshness}
        </p>
      ) : null}
      {message.notice ? (
        <p className="mt-2 text-[length:var(--text-xs)] leading-5 text-[var(--team-muted)]">
          {message.notice}
        </p>
      ) : null}
    </section>
  );
}

function CitationRow({ citation }: { citation: ChatCitation }) {
  const rowClass =
    "flex min-w-0 items-baseline justify-between gap-3 border-b border-[var(--team-border)] pb-1.5 text-[length:var(--text-sm)] leading-6 text-[var(--team-ink-subtle)] last:border-b-0";

  const meta = (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--team-muted)]">
      {citation.provider}
      {citation.sourceUrl ? <ExternalLink aria-hidden="true" size={14} /> : null}
    </span>
  );

  if (!citation.sourceUrl) {
    return (
      <div className={rowClass}>
        <span className="min-w-0">{citation.title}</span>
        {meta}
      </div>
    );
  }

  return (
    <a
      className={`${rowClass} transition-colors duration-[var(--dur-short)] ease-[var(--ease-out)] hover:text-[var(--team-accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--team-accent)]`}
      href={citation.sourceUrl}
      rel="noreferrer"
      target="_blank"
    >
      <span className="min-w-0">{citation.title}</span>
      {meta}
    </a>
  );
}
