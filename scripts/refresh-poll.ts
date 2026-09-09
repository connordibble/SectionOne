import path from "node:path";
import { fetchVerifiedPoll } from "../src/server/facts/poll-provider";
import { publishPollFile } from "../src/server/facts/poll-file";
import { reportError } from "../src/server/observability/report";

async function main() {
  const season = Number(process.argv[2] ?? new Date().getUTCFullYear());
  if (!Number.isInteger(season) || season < 2000 || season > 2200) throw new Error("Invalid season");
  const poll = await fetchVerifiedPoll(season);
  const file = path.join(process.cwd(), "data/facts/ap-poll.json");
  await publishPollFile(file, poll);
  console.log(JSON.stringify({ status: "verified", season, week: poll.week, teams: poll.polls[0].ranks.length }));
}
main().catch((error) => {
  reportError(error, { scope: "facts/poll-build" });
  process.exitCode = 1;
});
