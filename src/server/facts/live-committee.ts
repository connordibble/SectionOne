import { reportDegradation } from "@/server/observability/report";
import { fetchVerifiedCommitteeRanking } from "./committee-provider";
import { createCommitteeRefresher } from "./committee-refresh";
import { getBundledCommitteeRanking } from "./committee-snapshot";

const refresh = createCommitteeRefresher({
  fetch: fetchVerifiedCommitteeRanking,
  fallback: getBundledCommitteeRanking,
  report: (reason) => reportDegradation(reason, { scope: "facts/committee" }),
});

// `firstRelease` comes from the season rules: before it there is nothing to
// fetch, so the feed is not asked the same question every fifteen minutes all
// summer. The bundled snapshot still answers.
export function getLatestCommitteeRanking(season: number, firstRelease: string | undefined, today: string) {
  if (process.env.SPORTS_FACTS === "fixture" || !firstRelease || today < firstRelease) {
    return Promise.resolve(getBundledCommitteeRanking(season));
  }
  return refresh(season);
}
