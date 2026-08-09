import type { LlmUsage } from "./types";

// Rates are microdollars per million tokens, so the whole money path stays in
// integers. Floating point never touches a cost figure: the single rounding
// step is at the end of estimateCostMicroUsd.
//
// 1 USD = 1_000_000 microdollars, so $1.00 / Mtok = 1_000_000 micro / Mtok.
type ModelRate = {
  inputMicroPerMtok: number;
  outputMicroPerMtok: number;
};

const usd = (dollars: number) => Math.round(dollars * 1_000_000);

// Keyed by the model IDs this app can actually send or receive. Both forms
// matter: requests go out with the alias (`claude-haiku-4-5`) but `usage` is
// costed off `response.model`, which comes back pinned
// (`claude-haiku-4-5-20251001`). A table with only the alias throws on every
// live call.
const modelRates: Record<string, ModelRate> = {
  "claude-haiku-4-5": { inputMicroPerMtok: usd(1), outputMicroPerMtok: usd(5) },
  "claude-haiku-4-5-20251001": { inputMicroPerMtok: usd(1), outputMicroPerMtok: usd(5) },
  "claude-sonnet-5": { inputMicroPerMtok: usd(3), outputMicroPerMtok: usd(15) },
  "claude-opus-5": { inputMicroPerMtok: usd(5), outputMicroPerMtok: usd(25) },
  "claude-opus-4-8": { inputMicroPerMtok: usd(5), outputMicroPerMtok: usd(25) },
};

export class UnknownModelPricingError extends Error {
  constructor(readonly model: string) {
    super(
      `No pricing entry for model "${model}". Add it to src/server/llm/pricing.ts before costing it.`,
    );
    this.name = "UnknownModelPricingError";
  }
}

// Throws rather than guessing. An unpriced model must not be silently costed at
// a neighbour's rate — a future model could be more expensive than anything in
// this table, and a wrong number in the ledger is worse than a missing one.
//
// Callers record usage on a best-effort path, so this throw degrades to "tokens
// recorded, cost null" rather than failing the user's answer.
export function estimateCostMicroUsd(usage: LlmUsage): number {
  const rate = modelRates[usage.model];

  if (!rate) {
    throw new UnknownModelPricingError(usage.model);
  }

  const input = (usage.inputTokens * rate.inputMicroPerMtok) / 1_000_000;
  const output = (usage.outputTokens * rate.outputMicroPerMtok) / 1_000_000;

  return Math.round(input + output);
}

export function isModelPriced(model: string): boolean {
  return model in modelRates;
}

// numeric(10,6) wants a decimal string; going through Number here would put
// float back into the money path we just avoided.
export function microUsdToDecimalString(microUsd: number): string {
  const negative = microUsd < 0;
  const absolute = Math.abs(Math.trunc(microUsd));
  const whole = Math.trunc(absolute / 1_000_000);
  const fraction = String(absolute % 1_000_000).padStart(6, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function decimalStringToMicroUsd(value: string): number {
  const [whole, fraction = ""] = value.trim().split(".");
  const paddedFraction = fraction.padEnd(6, "0").slice(0, 6);
  const magnitude =
    Math.abs(Number(whole)) * 1_000_000 + Number(paddedFraction || "0");

  return whole.trim().startsWith("-") ? -magnitude : magnitude;
}
