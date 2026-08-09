import { sql } from "drizzle-orm";
import { getSharedDb, type Db } from "@/server/db/client";
import { llmUsage } from "@/server/db/schema";
import {
  estimateCostMicroUsd,
  microUsdToDecimalString,
  UnknownModelPricingError,
} from "./pricing";
import type { LlmUsage } from "./types";
import { reportDegradation } from "@/server/observability/report";

export type UsageEntry = {
  teamSlug: string;
  provider: string;
  usage: LlmUsage;
  // False when the acceptance gate rejected this generation. The call was
  // still billed, so it is still recorded.
  accepted: boolean;
};

// Best-effort, exactly like persistChatExchange. Enforcement lives on the
// Anthropic workspace spend limit, so a failure here costs visibility, never
// correctness of the user's answer — and must never take chat down.
export async function recordLlmUsage(entry: UsageEntry, dbOverride?: Db): Promise<void> {
  const db = dbOverride ?? getSharedDb();

  if (!db) {
    return;
  }

  try {
    await db.insert(llmUsage).values({
      teamSlug: entry.teamSlug,
      provider: entry.provider,
      model: entry.usage.model,
      inputTokens: entry.usage.inputTokens,
      outputTokens: entry.usage.outputTokens,
      costUsd: costColumn(entry.usage),
      accepted: entry.accepted,
    });
  } catch (error) {
    reportDegradation(`usage attribution skipped: ${error instanceof Error ? error.message : String(error)}`, {
      scope: "llm/usage",
      fingerprint: "llm/usage:write",
    });
  }
}

// Month-to-date spend in microdollars, or null when there is no database to
// read from. Null means "attribution unavailable", not "zero spent" — callers
// must not render it as $0.
export async function getMonthToDateSpendMicroUsd(dbOverride?: Db): Promise<number | null> {
  const db = dbOverride ?? getSharedDb();

  if (!db) {
    return null;
  }

  try {
    const rows = await db
      .select({ total: sql<string | null>`coalesce(sum(${llmUsage.costUsd}), 0)::text` })
      .from(llmUsage)
      .where(sql`${llmUsage.createdAt} >= date_trunc('month', now())`);

    return decimalToMicroUsd(rows[0]?.total ?? "0");
  } catch (error) {
    reportDegradation(`spend lookup failed: ${error instanceof Error ? error.message : String(error)}`, {
      scope: "llm/usage",
      fingerprint: "llm/usage:read",
    });
    return null;
  }
}

// An unpriced model still gets its tokens recorded. Dropping the row would hide
// real spend; costing it at a neighbouring model's rate would put a wrong
// number in the ledger, which is worse than a missing one.
function costColumn(usage: LlmUsage): string | null {
  try {
    return microUsdToDecimalString(estimateCostMicroUsd(usage));
  } catch (error) {
    if (error instanceof UnknownModelPricingError) {
      reportDegradation(`${error.message} Recording tokens without a cost.`, {
        scope: "llm/pricing",
        fingerprint: "llm/pricing:unknown-model",
      });
      return null;
    }

    throw error;
  }
}

// postgres.js hands numerics back as strings precisely so they don't lose
// precision through a float. Parse to integer microdollars rather than Number().
function decimalToMicroUsd(value: string): number {
  const [whole, fraction = ""] = value.trim().replace(/^\+/, "").split(".");
  const negative = whole.startsWith("-");
  const wholeDigits = whole.replace("-", "") || "0";
  const paddedFraction = fraction.padEnd(6, "0").slice(0, 6);
  const magnitude = Number(wholeDigits) * 1_000_000 + Number(paddedFraction || "0");

  return negative ? -magnitude : magnitude;
}
