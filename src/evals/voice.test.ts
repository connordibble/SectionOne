import { describe, expect, it } from "vitest";
import { evaluateVoiceSample } from "@/lib/content/voice";

describe("sports-native voice eval", () => {
  it("accepts source-grounded fan analyst language", () => {
    const result = evaluateVoiceSample(
      "Texas has to win early downs so the pass game is not living behind the sticks. The next-game fixture points to Ohio State as the first real line-of-scrimmage test. [Schedule fixture]",
    );

    expect(result.passed).toBe(true);
    expect(result.matchedFootballTerms).toContain("early downs");
    expect(result.matchedFootballTerms).toContain("line of scrimmage");
  });

  it("rejects generic tech-demo sports copy", () => {
    const result = evaluateVoiceSample(
      "As an AI, it is important to note that fans should check the application for more information about the team.",
    );

    expect(result.passed).toBe(false);
    expect(result.flags).toContain("banned phrase: as an ai");
    expect(result.flags).toContain("missing football-specific language");
    expect(result.flags).toContain("missing citation or freshness cue");
  });

  it("rejects rivalry bait even when football terms are present", () => {
    const result = evaluateVoiceSample(
      "The front seven matchup matters, but calling the opponent a poverty program is lazy rivalry bait. [Source freshness: fixture]",
    );

    expect(result.passed).toBe(false);
    expect(result.flags).toContain("toxic rivalry language: poverty program");
  });
});

describe("per-team voice contracts", () => {
  it("enforces a phrase the team banned but the platform baseline allows", () => {
    const text =
      "Texas controls the line of scrimmage on early downs, and we are the official partner of nobody. [Schedule fixture]";

    // The team contract is what makes this a per-team seam rather than a
    // hardcoded global list. Without it, TeamConfig.voice is decoration.
    const withContract = evaluateVoiceSample(text, {
      contract: { bannedPhrases: ["we are the official partner"] },
    });

    expect(withContract.passed).toBe(false);
    expect(withContract.flags).toContain("banned phrase: we are the official partner");
  });

  it("counts a team's preferred terms as football-specific language", () => {
    const result = evaluateVoiceSample(
      "The tempo package is the tell this week. [Schedule fixture]",
      { contract: { preferredTerms: ["tempo package"] } },
    );

    expect(result.matchedFootballTerms).toContain("tempo package");
    expect(result.flags).not.toContain("missing football-specific language");
  });
});

describe("citation validity", () => {
  const retrieved = ["Texas football 2026 schedule", "Texas vs Texas State"];

  it("accepts tags that name a retrieved source", () => {
    const result = evaluateVoiceSample(
      "Texas wins early downs and field position. [Texas football 2026 schedule]",
      { validCitationTitles: retrieved },
    );

    expect(result.flags).toEqual([]);
    expect(result.passed).toBe(true);
  });

  // The old check matched any bracketed text, so an invented source passed. On
  // a product whose claim is that every answer is verifiable, that is the
  // failure that matters most.
  it("rejects a fabricated citation that looks plausible", () => {
    const result = evaluateVoiceSample(
      "Texas wins early downs and field position. [Definitely Real Source]",
      { validCitationTitles: retrieved },
    );

    expect(result.passed).toBe(false);
    expect(result.flags).toContain("unknown citation: Definitely Real Source");
  });

  it("skips tag validation when no retrieval context is supplied", () => {
    const result = evaluateVoiceSample(
      "Texas wins early downs and field position. [Anything At All]",
    );

    expect(result.passed).toBe(true);
  });
});
