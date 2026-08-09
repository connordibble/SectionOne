// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decimalStringToMicroUsd,
  estimateCostMicroUsd,
  isModelPriced,
  microUsdToDecimalString,
  UnknownModelPricingError,
} from "./pricing";

describe("estimateCostMicroUsd", () => {
  // Requests go out with the alias but `usage` is costed off `response.model`,
  // which comes back pinned. A table holding only the alias throws on every
  // live call, so both forms must resolve to the same rate.
  it("prices the alias and the pinned response ID identically", () => {
    const usage = { inputTokens: 3_000, outputTokens: 300 };

    expect(estimateCostMicroUsd({ ...usage, model: "claude-haiku-4-5" })).toBe(
      estimateCostMicroUsd({ ...usage, model: "claude-haiku-4-5-20251001" }),
    );
  });

  it("computes Haiku 4.5 cost at $1/$5 per Mtok", () => {
    // 3,000 input at $1/Mtok = 3,000 micro; 300 output at $5/Mtok = 1,500 micro.
    expect(
      estimateCostMicroUsd({
        inputTokens: 3_000,
        outputTokens: 300,
        model: "claude-haiku-4-5",
      }),
    ).toBe(4_500);
  });

  // Guessing a rate puts a wrong number in the ledger, which is worse than a
  // missing one — a future model could cost more than anything listed here.
  it("throws rather than guessing a rate for an unknown model", () => {
    expect(() =>
      estimateCostMicroUsd({
        inputTokens: 10,
        outputTokens: 10,
        model: "claude-not-a-real-model",
      }),
    ).toThrow(UnknownModelPricingError);
  });

  it("reports whether a model is priced", () => {
    expect(isModelPriced("claude-haiku-4-5-20251001")).toBe(true);
    expect(isModelPriced("gpt-4o")).toBe(false);
  });
});

describe("microdollar conversion", () => {
  it("round-trips through the numeric(10,6) decimal form", () => {
    for (const micro of [0, 1, 4_500, 999_999, 1_000_000, 15_000_000]) {
      expect(decimalStringToMicroUsd(microUsdToDecimalString(micro))).toBe(micro);
    }
  });

  it("formats with the full six-digit scale", () => {
    expect(microUsdToDecimalString(4_500)).toBe("0.004500");
    expect(microUsdToDecimalString(15_000_000)).toBe("15.000000");
  });

  it("parses values postgres returns as strings", () => {
    expect(decimalStringToMicroUsd("0.004500")).toBe(4_500);
    expect(decimalStringToMicroUsd("2")).toBe(2_000_000);
  });
});
