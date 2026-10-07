import path from "node:path";
import { fetchVerifiedCommitteeRanking } from "../src/server/facts/committee-provider";
import { publishCommitteeFile } from "../src/server/facts/committee-file";
import { reportError } from "../src/server/observability/report";

async function main() {
  const season = Number(process.argv[2] ?? new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 2000 || season > 2200) throw new Error("Invalid season");
  const ranking = await fetchVerifiedCommitteeRanking(season);
  const file = path.join(process.cwd(), "data/facts/cfp-rankings.json");
  const saved = await publishCommitteeFile(file, season, ranking);
  console.log(JSON.stringify(saved.ranking
    ? { status: "verified", season, week: saved.ranking.week, releasedAt: saved.ranking.releasedAt }
    : { status: "not-released", season }));
}
main().catch((error) => {
  reportError(error, { scope: "facts/committee-build" });
  process.exitCode = 1;
});
