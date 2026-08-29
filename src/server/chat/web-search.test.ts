// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getTeamConfig } from "@/config/team";
import { searchWithGrounding } from "./web-search";

function responseWithCitations() {
  return {
    output_text:
      "TyAnthony Smith was dismissed from the football program in a personnel decision. [texaslonghorns.com] ((https://texaslonghorns.com/news/roster-change?utm_source=openai)) 【1†source】",
    model: "gpt-5.6-luna-2026-07-30",
    usage: { input_tokens: 30, output_tokens: 20 },
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "TyAnthony Smith was dismissed from the football program in a personnel decision. 【1†source】",
            annotations: [
              {
                type: "url_citation",
                title: "Texas announces roster change",
                url: "https://texaslonghorns.com/news/roster-change?utm_source=openai",
                start_index: 82,
                end_index: 92,
              },
              {
                type: "url_citation",
                title: "National roster report",
                url: "https://www.espn.com/college-football/story/_/id/123/texas-roster-report",
                start_index: 82,
                end_index: 92,
              },
              {
                type: "url_citation",
                title: "Unsafe result",
                url: "javascript:alert(1)",
                start_index: 82,
                end_index: 92,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("searchWithGrounding", () => {
  it("gives the agent multiple open-web searches and admits every safe citation it used", async () => {
    const team = getTeamConfig("texas-football");
    expect(team).toBeDefined();
    const create = vi.fn(async (params: unknown) => {
      expect(params).toBeDefined();
      return responseWithCitations();
    });

    const result = await searchWithGrounding(
      team!,
      {
        system: "Use the supplied Texas edition.",
        messages: [{ role: "user", content: "What happened to TyAnthony Smith?" }],
      },
      {
        env: { OPENAI_MODEL: "gpt-5.6-luna" },
        client: { responses: { create } } as never,
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining("current 2026 Texas football roster status"),
        max_tool_calls: 4,
        reasoning: { effort: "medium" },
        tool_choice: "required",
        tools: [
          expect.objectContaining({
            type: "web_search",
            search_context_size: "high",
          }),
        ],
      }),
    );
    expect((create.mock.calls[0][0] as { tools: unknown[] }).tools[0]).not.toHaveProperty(
      "filters",
    );
    expect((create.mock.calls[0][0] as { input: string }).input).toContain("Ty'Anthony Smith");
    expect((create.mock.calls[0][0] as { input: string }).input).toContain(
      "Texas football final 2026 depth chart roster changes",
    );
    expect(result.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Texas announces roster change",
          sourceUrl: "https://texaslonghorns.com/news/roster-change",
        }),
        expect.objectContaining({
          title: "National roster report",
          sourceUrl:
            "https://www.espn.com/college-football/story/_/id/123/texas-roster-report",
        }),
      ]),
    );
    expect(result.text).toContain("[Texas announces roster change]");
    expect(result.text).toContain("[National roster report]");
    expect(result.text).not.toContain("Unsafe result");
    expect(result.text).not.toContain("texaslonghorns.com]");
    expect(result.text).not.toContain("https://");
    expect(result.text).not.toContain("【");
  });

  it("adds a conflict-resolution research plan to current role questions", async () => {
    const team = getTeamConfig("texas-football");
    const create = vi.fn(async (params: unknown) => {
      expect(params).toBeDefined();
      return responseWithCitations();
    });

    await searchWithGrounding(
      team!,
      {
        system: "Use the supplied Texas edition.",
        messages: [{ role: "user", content: "Who is the backup QB?" }],
        grounding: {
          teamName: "Texas",
          teamDisplayName: "Texas football",
          seasonYear: 2026,
          upcomingGames: [],
          sourceReadiness: [],
          excerpts: [],
          citationTitles: [],
        },
      },
      {
        env: { OPENAI_MODEL: "gpt-5.6-luna" },
        client: { responses: { create } } as never,
      },
    );

    const input = (create.mock.calls[0][0] as { input: string }).input;
    expect(input).toContain("current role, workload, or depth-chart question");
    expect(input).toContain(
      'Depth-chart query: "Texas football final 2026 depth chart after fall camp"',
    );
    expect(input).toContain("prefer the newer role-specific report");
  });
});
