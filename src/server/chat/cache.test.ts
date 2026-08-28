// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  cacheEnabled,
  corpusVersion,
  normalizeQuestion,
  resolveSimilarityThreshold,
} from "./cache";

describe("normalizeQuestion", () => {
  // Folds only what never changes an answer.
  it("ignores case, punctuation, and spacing", () => {
    expect(normalizeQuestion("Who does Utah State play next?")).toBe(
      normalizeQuestion("who does utah state play next"),
    );
    expect(normalizeQuestion("  Early   downs?? ")).toBe("early downs");
  });

  // The line the exact-match tier must not cross: two different asks sharing
  // most of their words are still two different asks.
  it("keeps genuinely different questions apart", () => {
    expect(normalizeQuestion("what should I watch on early downs")).not.toBe(
      normalizeQuestion("what should I watch on special teams"),
    );
  });
});

describe("corpusVersion", () => {
  it("is stable while the sources are", () => {
    expect(corpusVersion("utah-state-football")).toBe(corpusVersion("utah-state-football"));
  });

  // Two teams publish on different weeks and carry different schedules, so
  // their answers must never share a cache key.
  it("differs per team", () => {
    expect(corpusVersion("texas-football")).not.toBe(corpusVersion("utah-state-football"));
  });

  // The safety mechanism. Without this an answer written against last week's
  // package would keep being served after Sunday's update — stale content
  // under confident citations, which is the failure this product cannot
  // absorb. A team with no sources at all still produces a key rather than
  // throwing.
  it("produces a key even when a team has no sources", () => {
    expect(corpusVersion("nope-football")).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("similarity threshold", () => {
  it("defaults high enough that a near-miss does not hit", () => {
    expect(resolveSimilarityThreshold({})).toBe(0.97);
  });

  it("accepts a deliberate override inside the safe band", () => {
    expect(resolveSimilarityThreshold({ CHAT_CACHE_SIMILARITY: "0.95" })).toBe(0.95);
  });

  // A typo here would silently start serving wrong answers, so the knob is
  // clamped rather than trusted.
  it("refuses a value low enough to be dangerous", () => {
    expect(resolveSimilarityThreshold({ CHAT_CACHE_SIMILARITY: "0.5" })).toBe(0.97);
    expect(resolveSimilarityThreshold({ CHAT_CACHE_SIMILARITY: "nonsense" })).toBe(0.97);
    expect(resolveSimilarityThreshold({ CHAT_CACHE_SIMILARITY: "1.4" })).toBe(0.97);
  });
});

describe("cache switch", () => {
  // Off unless asked for. At current traffic a fresh generation per question is
  // cheap and easier to reason about than a reuse rule, so serving a second
  // reader someone else's answer has to be a decision somebody made on purpose.
  it("is off by default and has to be switched on explicitly", () => {
    expect(cacheEnabled({})).toBe(false);
    expect(cacheEnabled({ CHAT_CACHE: "off" })).toBe(false);
    expect(cacheEnabled({ CHAT_CACHE: "on" })).toBe(true);
  });
});
