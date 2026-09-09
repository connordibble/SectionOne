import { z } from "zod";
import { editorialSchema, editionPackageSchema } from "@/lib/editions/contract";
import { teamScheduleSchema } from "@/lib/facts/schedule";

export const teamConfigSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sport: z.literal("football"),
  league: z.literal("college-football"),
  conference: z.string().min(1),
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  referenceLabel: z.string().min(1),
  tagline: z.string().min(1),
  timeZone: z.string().refine((zone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone"),
  officialScheduleUrl: z.url(),
  aliases: z.array(z.string().min(1)),
  // Three anchors, not a hand-tuned palette. See DESIGN.md § Team portability.
  // OKLCH keeps the shared lightness ladder predictable as team identity moves
  // around the hue wheel; every new palette is still contrast-tested in CI.
  theme: z.object({
    // Team colour, in OKLCH degrees. 47 = burnt orange, 145 = forest green,
    // 264 = royal blue.
    hue: z.number().min(0).max(360),
    // Saturation. Above ~0.16 the accent starts fighting the text for
    // attention at the sizes this interface uses.
    chroma: z.number().min(0).max(0.2),
    // The dark that carries the masthead and other structural areas.
    //
    // When a school's own primary is already dark — navy, maroon, forest —
    // this is that colour, because a fan should see their actual colours.
    // A bright primary can use a low-chroma dark version of its own hue for a
    // strong team edition, or a counterweight well away from `hue` when the
    // page needs more restraint.
    structuralHue: z.number().min(0).max(360),
    // Structural chroma can stay restrained for dark mastheads or move closer to
    // the official team colour when structuralLightness defines a bright one.
    structuralChroma: z.number().min(0).max(0.2),
    // Optional lightness for a bright branded structural colour. Omit it for the
    // standard dark frame used by the house theme and most editions.
    structuralLightness: z.number().min(0).max(100).optional(),
    // Keep an AA-safe primary unchanged after dark instead of dimming it.
    preserveStageInDark: z.boolean().optional(),
    // Optional school secondary for masthead highlights and field routes.
    secondary: z.object({
      hue: z.number().min(0).max(360),
      chroma: z.number().min(0).max(0.2),
      lightness: z.number().min(0).max(100),
    }).optional(),
  }),
  sourcePolicy: z.object({
    disclaimer: z.string().min(1),
    trustedSourceLabels: z.array(z.string().min(1)),
    // These outlets guide the research agent toward useful local coverage.
    // They are preferences, not an allowlist: a stronger current source may
    // sit elsewhere and can still be cited.
    preferredWebSearchDomains: z.array(z.string().min(1)).min(1),
    protectedMarksGuidance: z.array(z.string().min(1)),
  }),
  voice: z.object({
    posture: z.string().min(1),
    preferredTerms: z.array(z.string().min(1)),
    bannedPhrases: z.array(z.string().min(1)),
  }),
  editorial: editorialSchema,
  nextGameNote: z.string().min(1),
  cfbd: z
    .object({
      team: z.string().min(1),
      season: z.number().int(),
    })
    .optional(),
  suggestedPrompts: z.array(z.string().min(1)).min(1),
});

export type TeamConfig = z.infer<typeof teamConfigSchema>;

export const teamIdentitySchema = teamConfigSchema.omit({
  editorial: true, referenceLabel: true, nextGameNote: true,
}).strict();
export const teamManifestSchema = z.object({ identity: teamIdentitySchema, schedule: teamScheduleSchema }).strict()
  .superRefine((manifest, ctx) => {
    const { identity, schedule } = manifest;
    if (identity.slug !== schedule.teamSlug) ctx.addIssue({ code: "custom", path: ["schedule", "teamSlug"], message: "Schedule belongs to another team" });
    if (identity.shortName !== schedule.teamName || identity.displayName !== schedule.teamDisplayName) ctx.addIssue({ code: "custom", path: ["schedule"], message: "Schedule and team display names disagree" });
    if (identity.timeZone !== schedule.timeZone) ctx.addIssue({ code: "custom", path: ["schedule", "timeZone"], message: "Team and schedule timezones disagree" });
    // A verified print page and the fan-facing season page may have different
    // paths. Keep both destinations while checking their declared authority.
    try {
      const host = (value: string) => new URL(value).hostname.replace(/^www\./, "");
      if (host(identity.officialScheduleUrl) !== host(schedule.sourceUrl)) ctx.addIssue({ code: "custom", path: ["schedule", "sourceUrl"], message: "Official schedule domains disagree" });
    } catch { ctx.addIssue({ code: "custom", path: ["schedule", "sourceUrl"], message: "Invalid official schedule URL" }); }
    if (identity.cfbd && identity.cfbd.season !== schedule.seasonYear) ctx.addIssue({ code: "custom", path: ["identity", "cfbd", "season"], message: "Provider and schedule seasons disagree" });
  });
export const teamRegistrySchema = z.record(z.string(), teamManifestSchema).superRefine((registry, ctx) => {
  for (const [slug, manifest] of Object.entries(registry)) {
    if (slug !== manifest.identity.slug) ctx.addIssue({ code: "custom", path: [slug, "identity", "slug"], message: "Registry key and team slug disagree" });
  }
});
export type TeamIdentity = z.infer<typeof teamIdentitySchema>;
export type TeamManifest = z.infer<typeof teamManifestSchema>;

export const onboardingPackageSchema = z.object({
  schemaVersion: z.literal(1), manifest: teamManifestSchema, edition: editionPackageSchema,
}).strict().superRefine(({ manifest, edition }, ctx) => {
  if (manifest.identity.slug !== edition.teamSlug) ctx.addIssue({ code: "custom", path: ["edition", "teamSlug"], message: "Edition belongs to another team" });
  if (manifest.schedule.seasonYear !== edition.issue.season) ctx.addIssue({ code: "custom", path: ["edition", "issue", "season"], message: "Edition and schedule seasons disagree" });
});
export type OnboardingPackage = z.infer<typeof onboardingPackageSchema>;
