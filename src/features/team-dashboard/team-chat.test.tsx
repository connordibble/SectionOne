import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamChat } from "./team-chat";

function sseResponse(events: Array<{ event: string; data: unknown }>) {
  const body = events
    .map((entry) => `event: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`)
    .join("");

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const answerEvents = [
  {
    event: "citations",
    data: {
      citations: [
        {
          id: "doc-1",
          title: "Texas football 2026 schedule",
          sourceUrl: "https://example.com/schedule",
          provider: "fixture",
        },
      ],
    },
  },
  { event: "delta", data: { text: "Texas opens " } },
  {
    event: "delta",
    data: { text: "vs Texas State. [Texas football 2026 schedule]" },
  },
  {
    event: "done",
    data: {
      answer: "Texas opens vs Texas State. [Texas football 2026 schedule]",
      citations: [
        {
          id: "doc-1",
          title: "Texas football 2026 schedule",
          sourceUrl: "https://example.com/schedule",
          provider: "fixture",
        },
      ],
      freshness: {
        coverage: "Coverage updated August 27, 2026.",
        schedule: "Schedule updated July 1, 2026.",
      },
    },
  },
];

const baseProps = {
  mode: "brief" as const,
  starterRead: {
    question: "What matters?",
    answer: "Early downs.",
    citations: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TeamChat", () => {
  it("streams an answer into the thread with citations", async () => {
    const fetchMock = vi.fn(async () => sseResponse(answerEvents));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeamChat
        {...baseProps}
        suggestedPrompts={["Give me the next-game briefing."]}
        tagline="Test tagline"
        teamSlug="texas-football"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Give me the next-game briefing." }),
    );

    await screen.findByText("Texas opens vs Texas State.");
    expect(screen.getByText("Give me the next-game briefing.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Texas football 2026 schedule/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your signal" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByText("1 question")).toBeInTheDocument();
    // Once for the thread, not once per answer: per answer this ran to four
    // lines in the matchup dock, which is the block that was taken out from
    // between the answer and the composer.
    expect(screen.getAllByText(/Written by Section One from the sources shown/)).toHaveLength(1);
    expect(screen.getByText("1 source")).toBeInTheDocument();
    expect(screen.queryByText(/\[Texas football 2026 schedule\]/)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
    // Both facts survive, on one line rather than stacked. Asserted on the
    // single node so a future change back to a block of paragraphs fails here:
    // the stack is what pushed the composer down the page.
    const meta = screen.getByText(/Coverage updated August 27, 2026/);
    expect(meta).toHaveTextContent(
      "Coverage updated August 27, 2026 · Schedule updated July 1, 2026",
    );

    const requestBody = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    ) as { message: string; history: unknown[] };
    expect(requestBody.message).toBe("Give me the next-game briefing.");
    expect(requestBody.history).toEqual([]);
  });

  it("sends prior turns as history on follow-up questions", async () => {
    const fetchMock = vi.fn(async () => sseResponse(answerEvents));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeamChat
        {...baseProps}
        suggestedPrompts={["Give me the next-game briefing."]}
        tagline="Test tagline"
        teamSlug="texas-football"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Give me the next-game briefing." }),
    );
    await screen.findByText("Texas opens vs Texas State.");

    await userEvent.type(screen.getByLabelText("Ask Section One"), "And Ohio State?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body,
    ) as { history: Array<{ role: string; content: string }> };

    expect(secondBody.history).toEqual([
      { role: "user", content: "Give me the next-game briefing." },
      {
        role: "assistant",
        content: "Texas opens vs Texas State. [Texas football 2026 schedule]",
      },
    ]);
  });

  it("resets the thread and session for a new conversation", async () => {
    const fetchMock = vi.fn(async () => sseResponse(answerEvents));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeamChat
        {...baseProps}
        suggestedPrompts={["Give me the next-game briefing."]}
        tagline="Test tagline"
        teamSlug="texas-football"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Give me the next-game briefing." }),
    );
    await screen.findByText("Texas opens vs Texas State.");

    await userEvent.click(screen.getByRole("button", { name: /Start over/i }));

    expect(screen.queryByText("Texas opens vs Texas State.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Give me the next-game briefing." }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Ask Section One")).toHaveFocus());

    // A fresh conversation must not resend the old session id or history
    await userEvent.click(
      screen.getByRole("button", { name: "Give me the next-game briefing." }),
    );
    await screen.findByText("Texas opens vs Texas State.");
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body,
    ) as { history: unknown[]; sessionId?: string };
    expect(secondBody.history).toEqual([]);
    expect(secondBody.sessionId).toBeUndefined();
  });

  it("surfaces request failures inside the assistant bubble", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Unknown team slug: nope" }), { status: 404 }),
      ),
    );

    render(
      <TeamChat
        {...baseProps}
        suggestedPrompts={["Prompt"]}
        tagline="Test tagline"
        teamSlug="nope"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Prompt" }));

    await screen.findByText("Unknown team slug: nope");
  });
});
