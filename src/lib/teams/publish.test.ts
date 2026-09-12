// @vitest-environment node
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import manifests from "../../../data/teams/current.json";
import editions from "../../../data/editions/current.json";
import { onboardingPackageSchema, teamManifestSchema } from "./contract";
import { onboardTeam, publishTeamSchedule, readTeamRegistry } from "./publish";
import { checkTeams } from "./preflight";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "team-onboarding-")); roots.push(root);
  const manifest = structuredClone(manifests["texas-football"]);
  manifest.identity.slug = "example-football"; manifest.schedule.teamSlug = "example-football";
  const edition = { ...structuredClone(editions["texas-football"]), teamSlug: "example-football" };
  // Weekly refreshes must remain in the past, with the schedule old enough
  // for the preflight warning this fixture exercises.
  const now = new Date(Math.max(Date.parse(edition.publishedAt), Date.parse(manifest.schedule.capturedAt)) + 49 * 60 * 60 * 1000);
  return { root, candidate: onboardingPackageSchema.parse({ schemaVersion: 1, manifest, edition }), now };
}

it("onboards from data, resumes an interrupted import, and never overwrites an existing edition", async () => {
  const { root, candidate, now } = await fixture();
  const editionDir = path.join(root, "data/editions"); await mkdir(editionDir, { recursive: true });
  // Simulate a process stopping after edition staging but before activation.
  await writeFile(path.join(editionDir, "current.json"), JSON.stringify({ "example-football": candidate.edition }));
  expect(await readTeamRegistry(root)).toEqual({});
  expect((await onboardTeam(root, candidate, now)).status).toBe("onboarded");
  expect((await readTeamRegistry(root))["example-football"]).toEqual(candidate.manifest);
  const saved = await readFile(path.join(editionDir, "current.json"), "utf8");
  expect((await onboardTeam(root, candidate, now)).status).toBe("unchanged");
  await expect(onboardTeam(root, { ...candidate, edition: { ...candidate.edition, summary: "Changed after activation" } }, now)).rejects.toThrow("revision-checked");
  expect(await readFile(path.join(editionDir, "current.json"), "utf8")).toBe(saved);
  expect(await readdir(editionDir)).toEqual(["current.json"]);
  expect(await readdir(path.join(root, "data/teams"))).toEqual(["current.json"]);
});

it("rejects inconsistent identity, unsafe slugs and future content before activating a team", async () => {
  const { root, candidate, now } = await fixture();
  const wrong = structuredClone(candidate); wrong.manifest.schedule.teamSlug = "other-football";
  expect(onboardingPackageSchema.safeParse(wrong).success).toBe(false);
  wrong.manifest.identity.slug = "../other";
  expect(onboardingPackageSchema.safeParse(wrong).success).toBe(false);
  const invalidZone = structuredClone(candidate.manifest); invalidZone.schedule.timeZone = "Imaginary/Zone";
  expect(teamManifestSchema.safeParse(invalidZone).success).toBe(false);
  await expect(onboardTeam(root, candidate, new Date("2026-01-01"))).rejects.toThrow("future");
  expect(await readTeamRegistry(root)).toEqual({});
  await onboardTeam(root, candidate, now);
  const previous = await readTeamRegistry(root);
  await expect(publishTeamSchedule(root, { ...candidate.manifest.schedule, games: [] }, now)).rejects.toThrow("omitted");
  expect(await readTeamRegistry(root)).toEqual(previous);
});

it("release preflight reports missing assets and orphaned editions without pretending to verify sources", async () => {
  const { root, candidate, now } = await fixture();
  await onboardTeam(root, candidate, now);
  const result = await checkTeams(root, now);
  expect(result.ok).toBe(false);
  expect(result.findings).toContainEqual({ code: "social-image-missing", teamSlug: "example-football", severity: "error" });
  expect(result.findings).toContainEqual({ code: "schedule-needs-recheck", teamSlug: "example-football", severity: "warning" });
  await writeFile(path.join(root, "data/teams/current.json"), "{}");
  expect((await checkTeams(root, now)).findings).toContainEqual({ code: "edition-without-team", teamSlug: "example-football", severity: "error" });
});

it("loads an additional program in a separate checkout without modifying source code", async () => {
  const { root, candidate, now } = await fixture();
  for (const name of ["src", "data", "tsconfig.json"]) await cp(path.join(process.cwd(), name), path.join(root, name), { recursive: true });
  await symlink(path.join(process.cwd(), "node_modules"), path.join(root, "node_modules"));
  const configFile = path.join(root, "src/config/team.ts");
  const before = await readFile(configFile, "utf8");
  await onboardTeam(root, candidate, now);
  const child = spawnSync(process.execPath, ["--import", "tsx", "-e", `
    const assert = require('node:assert/strict');
    const { getTeamConfig, enabledTeamSlugs } = require('./src/config/team.ts');
    const { getTeamSchedule } = require('./src/server/schedule/schedule.ts');
    assert.equal(getTeamConfig('example-football').slug, 'example-football');
    assert.equal(getTeamSchedule('example-football').teamSlug, 'example-football');
    assert.equal(enabledTeamSlugs.length, ${Object.keys(manifests).length + 1});
  `], { cwd: root, encoding: "utf8", env: { ...process.env, TSX_TSCONFIG_PATH: path.join(root, "tsconfig.json") } });
  expect(child.status, child.stderr).toBe(0);
  expect(await readFile(configFile, "utf8")).toBe(before);
});
