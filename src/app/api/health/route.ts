import { enabledTeamSlugs, getSourceReadiness, teamConfigs } from "@/config/team";
import { describeLlmProvider } from "@/server/llm/registry";
import { describeEmbeddingProvider } from "@/server/embeddings/registry";
import { microUsdToDecimalString } from "@/server/llm/pricing";
import { getMonthToDateSpendMicroUsd } from "@/server/llm/usage";
import { hasDatabaseUrl } from "@/server/db/client";

export const runtime = "nodejs";

// How answers are being produced right now. Deliberately not a boolean: the
// interesting distinction is not "enforced / not enforced" but where the
// ceiling lives and whether spend is visible. The monthly limit is configured
// on the Anthropic workspace, so a missing database costs attribution, not
// cost safety — live-unmetered is a supported state, not a broken one.
export type LlmMode = "live-metered" | "live-unmetered" | "composer-only";

export async function GET() {
  const sources = Object.fromEntries(
    enabledTeamSlugs.map((slug) => [slug, getSourceReadiness(teamConfigs[slug])]),
  );

  const llm = describeLlmProvider();
  const databaseConfigured = hasDatabaseUrl();
  const liveProvider = llm.provider !== "mock";
  const mode: LlmMode = !liveProvider
    ? "composer-only"
    : databaseConfigured
      ? "live-metered"
      : "live-unmetered";

  const spendMicroUsd = mode === "live-metered" ? await getMonthToDateSpendMicroUsd() : null;

  return Response.json({
    ok: true,
    service: "saturday-signal",
    databaseConfigured,
    llm: {
      ...llm,
      mode,
      // Present only when there is a ledger to read. Null means attribution is
      // unavailable — it does not mean nothing has been spent.
      monthToDateUsd: spendMicroUsd === null ? null : microUsdToDecimalString(spendMicroUsd),
      attribution:
        mode === "live-metered"
          ? "recorded"
          : mode === "live-unmetered"
            ? "unavailable: no DATABASE_URL; spend ceiling is enforced on the Anthropic workspace"
            : "not applicable: no live provider configured",
    },
    embeddings: describeEmbeddingProvider(),
    enabledTeams: enabledTeamSlugs,
    sources,
  });
}
