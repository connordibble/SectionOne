import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { editionPackageSchema } from "../src/lib/editions/contract";
import { editionDraftSchema, editionRevision, publishEdition, readEditionRegistry } from "../src/lib/editions/publish";
import { reportDegradation, reportError } from "../src/server/observability/report";

async function main() {
  const [command, argument, output] = process.argv.slice(2);
  const root = process.cwd();
  if (command === "schema") {
    console.log(JSON.stringify(z.toJSONSchema(editionPackageSchema), null, 2));
    return;
  }
  if (command === "export" && argument && output) {
    const registry = await readEditionRegistry(root);
    const edition = registry[argument];
    if (!edition) throw new Error("Unknown team");
    await writeFile(output, `${JSON.stringify({ baseRevision: editionRevision(edition), edition }, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ status: "exported", teamSlug: argument }));
    return;
  }
  if (command === "check") {
    const registry = await readEditionRegistry(root);
    console.log(JSON.stringify({ status: "valid", teams: Object.keys(registry) }));
    return;
  }
  if ((command === "validate" || command === "publish") && argument) {
    const input: unknown = JSON.parse(await readFile(argument, "utf8"));
    const draft = editionDraftSchema.parse(input);
    console.log(JSON.stringify(command === "publish"
      ? await publishEdition(root, draft)
      : { status: "valid", teamSlug: draft.edition.teamSlug, revision: editionRevision(draft.edition) }));
    return;
  }
  throw new Error("Usage: pnpm edition <export team-slug output.json | validate draft.json | publish draft.json | check | schema>");
}

main().catch((error: unknown) => {
  // Validation diagnostics contain paths and codes, never source text or keys.
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`).join("; ")
    : error instanceof Error && ["Unknown team", "Cannot publish a future edition", "Cannot replace a newer edition with an older package", "Onboard the team before publishing an update", "Stale draft: export the latest edition and reconcile changes"].includes(error.message)
      ? error.message : "Edition command failed; check arguments, file access, and publication lock";
  process.exitCode = 1;
  if (error instanceof z.ZodError && process.argv[2] !== "check") {
    reportDegradation(message, { scope: "edition/cli", fingerprint: "edition/cli:validation" });
  } else {
    reportError(new Error(message), { scope: "edition/cli", fingerprint: "edition/cli:failure" });
  }
});
