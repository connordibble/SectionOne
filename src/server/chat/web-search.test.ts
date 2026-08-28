// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getTeamConfig } from "@/config/team";
import { isAllowedDomain, searchNamedSubject } from "./web-search";

function responseWithCitations() {
  return {
    output_text:
      "TyAnthony Smith was dismissed from the football program in a personnel decision. 【1†source】",
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
                url: "https://texaslonghorns.com/news/roster-change",
                start_index: 82,
                end_index: 92,
              },
              {
                type: "url_citation",
                title: "Unapproved recap",
                url: "https://example.com/copied-report",
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

describe("searchNamedSubject", () => {
  it("makes one domain-restricted search and admits only approved citation URLs", async () => {
    const team = getTeamConfig("texas-football");
    expect(team).toBeDefined();
    const create = vi.fn(async () => responseWithCitations());

    const result = await searchNamedSubject(
      team!,
      "What happened to TyAnthony Smith?",
      "TyAnthony Smith",
      {
        env: { OPENAI_MODEL: "gpt-5.6-luna" },
        client: { responses: { create } } as never,
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tool_calls: 1,
        tool_choice: "required",
        tools: [
          expect.objectContaining({
            type: "web_search",
            filters: { allowed_domains: team!.sourcePolicy.webSearchDomains },
          }),
        ],
      }),
    );
    expect(result.citations).toEqual([
      expect.objectContaining({
        title: "Texas announces roster change",
        sourceUrl: "https://texaslonghorns.com/news/roster-change",
      }),
    ]);
    expect(result.text).toContain("[Texas announces roster change]");
    expect(result.text).not.toContain("example.com");
    expect(result.text).not.toContain("【");
  });

  it("matches exact domains and subdomains without suffix confusion", () => {
    expect(isAllowedDomain("https://www.kxan.com/sports/story", ["kxan.com"])).toBe(true);
    expect(isAllowedDomain("https://kxan.com.evil.example/story", ["kxan.com"])).toBe(false);
    expect(isAllowedDomain("javascript:alert(1)", ["kxan.com"])).toBe(false);
  });
});
