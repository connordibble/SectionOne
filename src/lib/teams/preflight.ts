import { readFile } from "node:fs/promises";
import path from "node:path";
import { deriveTeamPalettes, type TeamPalette } from "./theme";
import { parseEditionRegistry } from "@/lib/editions/contract";
import { onboardingPackageSchema, type TeamManifest } from "./contract";
import { contrast } from "./contrast";
import { readTeamRegistry } from "./publish";

type Finding = { code: string; teamSlug: string; severity: "error" | "warning" };
export function checkManifest(manifest: TeamManifest, now = new Date()): Finding[] {
  const findings: Finding[] = [];
  const teamSlug = manifest.identity.slug;
  const checked = manifest.schedule.provenance?.officialVerifiedAt ?? manifest.schedule.provenance?.retrievedAt ?? manifest.schedule.capturedAt;
  if (Date.parse(checked) > now.getTime()) findings.push({ code: "future-schedule-check", teamSlug, severity: "error" });
  else if (now.getTime() - Date.parse(checked) > 48 * 3_600_000) findings.push({ code: "schedule-needs-recheck", teamSlug, severity: "warning" });
  if (!manifest.schedule.games.length) findings.push({ code: "schedule-empty", teamSlug, severity: "error" });
  const pairs: Array<[keyof TeamPalette, keyof TeamPalette, number]> = [
    ["ink", "page", 4.5], ["inkSubtle", "surfaceSoft", 4.5], ["muted", "surfaceSoft", 4.5],
    ["onStage", "stage", 4.5], ["onSteel", "steel", 4.5], ["onAccent", "accent", 4.5],
    ["accent", "page", 3], ["focus", "page", 3], ["graphicStrong", "stage", 3],
  ];
  for (const [mode, palette] of Object.entries(deriveTeamPalettes(manifest.identity.theme))) {
    for (const [foreground, background, minimum] of pairs) {
      if (contrast(palette[foreground], palette[background]) < minimum) findings.push({ code: `contrast:${mode}:${foreground}:${background}`, teamSlug, severity: "error" });
    }
  }
  return findings;
}

async function checkSocialAsset(root: string, slug: string): Promise<Finding[]> {
  try {
    const image = await readFile(path.join(root, "public/social", `${slug}.png`));
    if (image.length < 24 || image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630) {
      return [{ code: "social-image-invalid", teamSlug: slug, severity: "error" }];
    }
    return [];
  } catch { return [{ code: "social-image-missing", teamSlug: slug, severity: "error" }]; }
}

export async function preflightOnboarding(root: string, input: unknown, now = new Date()) {
  const candidate = onboardingPackageSchema.parse(input);
  const findings = [...checkManifest(candidate.manifest, now), ...await checkSocialAsset(root, candidate.manifest.identity.slug)];
  if (Date.parse(candidate.edition.publishedAt) > now.getTime()) findings.push({ code: "future-edition", teamSlug: candidate.edition.teamSlug, severity: "error" });
  return { ok: !findings.some((finding) => finding.severity === "error"), teamSlug: candidate.edition.teamSlug, findings };
}

export async function checkTeams(root: string, now = new Date()) {
  const teams = await readTeamRegistry(root);
  const editions = parseEditionRegistry(JSON.parse(await readFile(path.join(root, "data/editions/current.json"), "utf8")));
  const findings: Finding[] = [];
  for (const [slug, manifest] of Object.entries(teams)) {
    findings.push(...checkManifest(manifest, now), ...await checkSocialAsset(root, slug));
    if (!editions[slug]) findings.push({ code: "edition-missing", teamSlug: slug, severity: "error" });
    else if (editions[slug].issue.season !== manifest.schedule.seasonYear) findings.push({ code: "edition-season-mismatch", teamSlug: slug, severity: "error" });
  }
  for (const slug of Object.keys(editions)) if (!teams[slug]) findings.push({ code: "edition-without-team", teamSlug: slug, severity: "error" });
  return { ok: !findings.some((finding) => finding.severity === "error"), teams: Object.keys(teams), findings };
}
