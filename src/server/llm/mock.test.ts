// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateVoiceSample } from "@/lib/content/voice";
import { createMockLlmProvider } from "./mock";
import type { GroundingContext, LlmRequest } from "./types";

const baseGrounding: GroundingContext = {
  teamName: "Texas",
  teamDisplayName: "Texas football",
  seasonYear: 2026,
  capability: "next-game-brief",
  nextGame: {
    opponent: "Texas State",
    site: "home",
    dateLabel: "Saturday, September 5",
    kickoff: "2:30 p.m. CT",
    venue: "DKR-Texas Memorial Stadium, Austin, Texas",
    tv: "ESPN",
  },
  upcomingGames: [
    {
      opponent: "Texas State",
      site: "home",
      dateLabel: "Saturday, September 5",
      kickoff: "2:30 p.m. CT",
      venue: "DKR-Texas Memorial Stadium, Austin, Texas",
      tv: "ESPN",
    },
    {
      opponent: "Ohio State",
      site: "home",
      dateLabel: "Saturday, September 12",
      kickoff: "6:30 p.m. CT",
      venue: "DKR-Texas Memorial Stadium, Austin, Texas",
      tv: "ABC",
    },
  ],
  sourceReadiness: [
    { label: "Schedule", state: "Ready" },
    { label: "Season statistics", state: "Planned" },
  ],
  scheduleCapturedAt: "July 1, 2026",
  excerpts: [{ title: "Texas vs Texas State", content: "Texas vs Texas State on September 5." }],
  citationTitles: ["Texas football 2026 schedule", "Texas vs Texas State"],
};

const nextGameRequest: LlmRequest = {
  system: "system prompt",
  messages: [{ role: "user", content: "Give me the next-game briefing." }],
  grounding: baseGrounding,
};

function withGrounding(overrides: Partial<GroundingContext>): LlmRequest {
  return { ...nextGameRequest, grounding: { ...baseGrounding, ...overrides } };
}

// Every composer branch has to clear the same gate a live model does, so each
// case asserts the voice contract passes with the citation titles it was given.
function expectAccepted(text: string, grounding: GroundingContext) {
  const evaluation = evaluateVoiceSample(text, {
    validCitationTitles: grounding.citationTitles,
  });

  expect(evaluation.flags).toEqual([]);
  expect(evaluation.passed).toBe(true);
}

describe("mock LLM provider", () => {
  it("composes a grounded next-game answer that passes the voice contract", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.generate(nextGameRequest);

    expect(result.text).toContain("Texas opens the 2026 schedule vs Texas State");
    expect(result.text).toContain("[Texas football 2026 schedule]");
    expectAccepted(result.text, baseGrounding);
  });

  it("lists the slate for the schedule capability", async () => {
    const provider = createMockLlmProvider();
    const request = withGrounding({ capability: "schedule" });
    const result = await provider.generate(request);

    expect(result.text).toContain("vs Texas State");
    expect(result.text).toContain("vs Ohio State");
    expectAccepted(result.text, request.grounding!);
  });

  it("reports the ledger for the source-readiness capability", async () => {
    const provider = createMockLlmProvider();
    const request = withGrounding({ capability: "source-readiness" });
    const result = await provider.generate(request);

    expect(result.text).toContain("Schedule (Ready)");
    expect(result.text).toContain("Season statistics (Planned)");
    expectAccepted(result.text, request.grounding!);
  });

  it("surfaces the curated note for the team-note capability", async () => {
    const request = withGrounding({
      capability: "team-note-brief",
      excerpts: [
        {
          title: "Sample roster note",
          content: "The interior offensive line rotation is still unsettled. More detail here.",
        },
      ],
      citationTitles: ["Sample roster note"],
    });
    const result = await createMockLlmProvider().generate(request);

    expect(result.text).toContain("The interior offensive line rotation is still unsettled.");
    expect(result.text).toContain("[Sample roster note]");
    expectAccepted(result.text, request.grounding!);
  });

  it("keeps kickoff abbreviations inside a complete sentence", async () => {
    const request = withGrounding({
      capability: undefined,
      excerpts: [
        {
          title: "Texas vs Ohio State",
          content:
            "Ohio State is the first big line-of-scrimmage test. Kickoff: 6:30 p.m. CT. Venue: Austin.",
        },
      ],
      citationTitles: ["Texas vs Ohio State"],
    });
    const result = await createMockLlmProvider().generate(request);

    expect(result.text).toContain("Kickoff: 6:30 p.m. CT.");
    expect(result.text).not.toContain("test. m.");
    expectAccepted(result.text, request.grounding!);
  });

  it("never fabricates a citation tag when nothing was retrieved", async () => {
    const request = withGrounding({ citationTitles: [], excerpts: [] });
    const result = await createMockLlmProvider().generate(request);

    // A bracketed tag here would be an invented source, which is exactly what
    // the acceptance gate exists to reject.
    expect(result.text).not.toMatch(/\[[^\]]+\]/);
    expect(result.text).toContain("No matching source was found.");
    expectAccepted(result.text, request.grounding!);
  });

  it("streams the exact same text it generates", async () => {
    const provider = createMockLlmProvider();
    const generated = await provider.generate(nextGameRequest);

    let streamed = "";
    for await (const delta of provider.stream(nextGameRequest)) {
      streamed += delta;
    }

    expect(streamed).toBe(generated.text);
  });

  it("answers safely when no grounding is provided", async () => {
    const provider = createMockLlmProvider();
    const result = await provider.generate({ system: "s", messages: [] });

    expect(evaluateVoiceSample(result.text).passed).toBe(true);
  });
});
