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

// Month-to-date spend is business data, and this endpoint is public and
// unauthenticated. Anyone could watch the number move and infer traffic, so
// the money fields are gated behind a shared token.
//
// Fails closed: with no HEALTH_TOKEN configured nobody is authorized, which is
// the safe default for a deployment where the variable was forgotten. The rest
// of the payload stays public because it is genuinely useful for uptime checks
// and gives an attacker nothing.
function isAuthorized(request: Request): boolean {
  const expected = process.env.HEALTH_TOKEN;

  if (!expected) {
    return false;
  }

  const presented = request.headers.get("x-health-token");

  return presented !== null && timingSafeEquals(presented, expected);
}

// Compares in time proportional to the presented value's length rather than to
// how many characters matched, so the response time does not leak a prefix.
function timingSafeEquals(left: string, right: string): boolean {
  // Guards the divisor, not the result: `index % right.length || 1` would turn
  // every position-0 comparison into position 1 and never match.
  const divisor = right.length || 1;
  let difference = left.length ^ right.length;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index % divisor);
  }

  return difference === 0;
}

export async function GET(request: Request) {
  const authorized = isAuthorized(request);
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

  // Not read at all unless the caller is authorized: an unauthenticated
  // request should not be able to make the server query the ledger.
  const spendMicroUsd =
    authorized && mode === "live-metered" ? await getMonthToDateSpendMicroUsd() : null;

  return Response.json({
    ok: true,
    service: "section-one",
    databaseConfigured,
    llm: {
      ...llm,
      mode,
      // Only for an authorized caller. Null here means "not shown", which is
      // not the same as zero — and when authorized, null still means
      // attribution is unavailable rather than that nothing has been spent.
      ...(authorized
        ? {
            monthToDateUsd:
              spendMicroUsd === null ? null : microUsdToDecimalString(spendMicroUsd),
            attribution:
              mode === "live-metered"
                ? "recorded"
                : mode === "live-unmetered"
                  ? "unavailable: no DATABASE_URL; spend ceiling is enforced on the Anthropic workspace"
                  : "not applicable: no live provider configured",
          }
        : {}),
    },
    embeddings: describeEmbeddingProvider(),
    enabledTeams: enabledTeamSlugs,
    sources,
  });
}
