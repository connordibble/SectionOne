import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { onboardingPackageSchema } from "../src/lib/teams/contract";
import { onboardTeam, readTeamRegistry } from "../src/lib/teams/publish";
import { checkTeams, preflightOnboarding } from "../src/lib/teams/preflight";
import { readEditionRegistry } from "../src/lib/editions/publish";
import { reportError } from "../src/server/observability/report";
import { pollWeekSchema } from "../src/lib/facts/poll";

async function main() {
  const [command, argument, output] = process.argv.slice(2);
  const root = process.cwd();
  if (command === "schema") return z.toJSONSchema(onboardingPackageSchema);
  if (command === "status") {
    const teams = await readTeamRegistry(root), editions = await readEditionRegistry(root);
    const poll = pollWeekSchema.parse(JSON.parse(await readFile(`${root}/data/facts/ap-poll.json`, "utf8")));
    return { checkedAt: new Date().toISOString(), scheduleRefreshConfigured: Boolean(process.env.CFBD_API_KEY),
      poll: { season: poll.season, capturedAt: poll.capturedAt, week: poll.week },
      teams: Object.values(teams).map(({ identity, schedule }) => ({ identity,
        schedule: { season: schedule.seasonYear, checkedAt: schedule.provenance?.officialVerifiedAt ?? schedule.provenance?.retrievedAt ?? schedule.capturedAt,
          games: schedule.games.map(({ date, status }) => ({ date, status })) },
        edition: editions[identity.slug] ? { publishedAt: editions[identity.slug].publishedAt, weekOf: editions[identity.slug].weekOf } : null })) };
  }
  if (command === "check") {
    const result = await checkTeams(root);
    if (process.argv.includes("--database")) {
      const { checkTeamDatabase } = await import("../src/lib/teams/database");
      result.findings.push(...await checkTeamDatabase(await readTeamRegistry(root)));
      result.ok = !result.findings.some((finding) => finding.severity === "error");
    }
    return result;
  }
  if (command === "manifest" && argument) {
    const manifest = (await readTeamRegistry(root))[argument];
    if (!manifest) throw new Error("Unknown team");
    return manifest;
  }
  if (command === "export" && argument && output) {
    const teams = await readTeamRegistry(root), editions = await readEditionRegistry(root);
    const candidate = onboardingPackageSchema.parse({ schemaVersion: 1, manifest: teams[argument], edition: editions[argument] });
    await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, { flag: "wx" });
    return { status: "exported", teamSlug: argument };
  }
  if ((command === "onboard" || command === "preflight" || command === "validate") && argument) {
    const input: unknown = JSON.parse(await readFile(argument, "utf8"));
    if (command === "validate") return { status: "valid", teamSlug: onboardingPackageSchema.parse(input).edition.teamSlug };
    return command === "onboard" ? onboardTeam(root, input) : preflightOnboarding(root, input);
  }
  throw new Error("Usage: pnpm teams <schema | status | check [--database] | manifest slug | export slug output.json | validate package.json | preflight package.json | onboard package.json>");
}
main().then((result) => {
  if ("ok" in result && result.ok === false) process.exitCode = 1;
  console.log(JSON.stringify(result, null, 2));
}).catch(() => {
  reportError(new Error("Team command failed; check the package schema, registry consistency and publication locks"), { scope: "teams/cli" });
  process.exitCode = 1;
});
