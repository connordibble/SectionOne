import { getMonthToDateSpendMicroUsd } from "@/server/llm/usage";
import { reportDegradation } from "@/server/observability/report";

// A soft monthly ceiling, enforced here in addition to the provider's own.
//
// The provider limit is the authority — it is the only thing that can actually
// stop a charge. But when it trips, the provider starts returning errors, and
// a fan sees a broken chat box. This trips first and lower, and the product
// simply answers from the composer instead. Same protection, better failure.
//
// It is not race-free: concurrent requests can each read a spend figure from
// just before the other's write. At Luna's rates a handful of overlapping
// answers is a rounding error against the cap, and paying for atomic
// reservations to close a gap worth fractions of a cent would be the wrong
// trade.
const defaultBudgetUsd = 25;

export type BudgetState =
  | { withinBudget: true }
  | { withinBudget: false; notice: string };

export function resolveMonthlyBudgetMicroUsd(
  env: Record<string, string | undefined> = process.env,
): number | null {
  const raw = env.LLM_MONTHLY_BUDGET_USD?.trim();

  // Explicitly disabled, for a deployment that trusts the provider limit alone.
  if (raw === "off") {
    return null;
  }

  const parsed = raw ? Number(raw) : defaultBudgetUsd;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.round(defaultBudgetUsd * 1_000_000);
  }

  return Math.round(parsed * 1_000_000);
}

// Checked before escalating to a paid provider, never on the composer path —
// a free answer must not be blocked by a spend ceiling.
//
// Fails open. If the ledger cannot be read the request proceeds: the provider
// limit still backstops the money, and taking chat down because a database is
// unreachable would trade a small cost risk for a total outage.
export async function checkBudget(
  env: Record<string, string | undefined> = process.env,
): Promise<BudgetState> {
  const capMicroUsd = resolveMonthlyBudgetMicroUsd(env);

  if (capMicroUsd === null) {
    return { withinBudget: true };
  }

  const spent = await getMonthToDateSpendMicroUsd();

  // Null means no ledger — either no database, or a read that failed. Neither
  // is evidence of overspending.
  if (spent === null || spent < capMicroUsd) {
    return { withinBudget: true };
  }

  reportDegradation(
    `monthly budget reached: ${spent} of ${capMicroUsd} microUSD; serving composer answers`,
    { scope: "chat/budget", fingerprint: "chat/budget:exhausted" },
  );

  return {
    withinBudget: false,
    notice: "Live answers are paused for this month. This is the verified local read.",
  };
}
