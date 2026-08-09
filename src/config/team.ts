import { z } from "zod";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { getTeamNoteDocuments } from "@/server/sources/notes";

export type SourceReadinessState = "Ready" | "Planned" | "Needs key";
export type SourceState = { label: string; state: SourceReadinessState };

const teamConfigSchema = z.object({
  slug: z.string().min(1),
  sport: z.literal("football"),
  league: z.literal("college-football"),
  conference: z.string().min(1),
  displayName: z.string().min(1),
  shortName: z.string().min(1),
  referenceLabel: z.string().min(1),
  tagline: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  // Three numbers, not fourteen hex values. See DESIGN.md § Theme: hand-tuning
  // a full palette per team is the biggest obstacle to "bring your own team",
  // and because OKLCH is perceptually uniform, deriving from a hue keeps
  // contrast relationships intact across schools instead of needing them
  // re-checked by eye for every new deployment.
  theme: z.object({
    // Team colour, in OKLCH degrees. 47 = burnt orange, 145 = forest green,
    // 264 = royal blue.
    hue: z.number().min(0).max(360),
    // Saturation. Above ~0.16 the accent starts fighting the text for
    // attention at the sizes this interface uses.
    chroma: z.number().min(0).max(0.2),
    // A cool structural counterweight so the page does not become a
    // single-hue wash. Should sit well away from `hue`.
    neutralHue: z.number().min(0).max(360),
  }),
  sourcePolicy: z.object({
    disclaimer: z.string().min(1),
    trustedSourceLabels: z.array(z.string().min(1)),
    protectedMarksGuidance: z.array(z.string().min(1)),
  }),
  voice: z.object({
    posture: z.string().min(1),
    preferredTerms: z.array(z.string().min(1)),
    bannedPhrases: z.array(z.string().min(1)),
  }),
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

export const teamConfigs = {
  "texas-football": teamConfigSchema.parse({
    slug: "texas-football",
    sport: "football",
    league: "college-football",
    conference: "SEC",
    displayName: "Texas football",
    shortName: "Texas",
    referenceLabel: "Texas football reference deployment",
    tagline: "Texas context, clean sources, Saturday-level signal.",
    aliases: ["Texas", "Longhorns", "UT Austin"],
    // Burnt orange that reads Texas without using the official UT colour.
    theme: {
      hue: 47,
      chroma: 0.13,
      neutralHue: 236,
    },
    sourcePolicy: {
      disclaimer:
        "Saturday Signal is not affiliated with, endorsed by, or sponsored by The University of Texas at Austin or Texas Athletics.",
      trustedSourceLabels: [
        "CollegeFootballData",
        "Official schedule links",
        "Verified game notes",
      ],
      protectedMarksGuidance: [
        "Do not use official logos or mascot imagery.",
        "Do not use Bevo as product branding.",
        "Do not imply official access, sponsorship, or endorsement.",
      ],
    },
    voice: {
      posture: "smart fan analyst",
      preferredTerms: [
        "early downs",
        "line of scrimmage",
        "explosiveness",
        "field position",
        "pressure",
        "success rate",
        "EPA",
        "PPA",
      ],
      bannedPhrases: [
        "as an AI",
        "it is important to note",
        "official partner",
        "guaranteed lock",
      ],
    },
    nextGameNote:
      "The opener is the first baseline check for early-down efficiency, clean operation, and whether Texas controls the line of scrimmage before the schedule tightens.",
    cfbd: {
      team: "Texas",
      season: 2026,
    },
    suggestedPrompts: [
      "What should Texas fans watch on early downs?",
      "Give me the next-game briefing.",
      "Where is the roster context still thin?",
    ],
  }),
} satisfies Record<string, TeamConfig>;

// The palette roles every component consumes. Names are stable and match the
// `--team-*` custom properties emitted onto the dashboard root, so a change to
// how colour is *derived* never becomes a change to how it is *consumed*.
export type TeamPalette = {
  page: string;
  surface: string;
  surfaceSoft: string;
  surfaceStrong: string;
  ink: string;
  inkSubtle: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  muted: string;
  border: string;
  borderStrong: string;
  contrast: string;
  steel: string;
};

// Lightness ladder, tuned once against WCAG AA and then reused by every team.
// The values that matter for contrast:
//   ink 22 on page 96.5   — body copy, far past AA
//   muted 46 on page 96.5 — secondary copy, clears AA at small sizes
//   contrast 99 on accent 52 — white on burnt orange, clears AA for body text
//   contrast 99 on steel 30  — masthead text, far past AA
// Because OKLCH lightness is perceptually uniform, these hold as `hue` rotates,
// which is the whole point of deriving rather than hand-picking.
export function deriveTeamPalette(theme: TeamConfig["theme"]): TeamPalette {
  const { hue, chroma, neutralHue } = theme;

  // Surfaces and text carry a trace of the team hue so the page reads warm (or
  // cool) rather than grey, but at a chroma low enough to stay neutral.
  const tint = Math.min(chroma * 0.22, 0.03);

  return {
    page: oklch(96.5, tint, hue),
    surface: oklch(98.5, tint * 0.6, hue),
    surfaceSoft: oklch(94, tint * 1.6, hue),
    surfaceStrong: oklch(89, tint * 2.4, hue),
    ink: oklch(22, tint * 1.1, hue),
    inkSubtle: oklch(34, tint * 1.2, hue),
    accent: oklch(52, chroma, hue),
    accentStrong: oklch(42, chroma * 0.96, hue),
    accentSoft: oklch(84, chroma * 0.54, hue),
    muted: oklch(46, tint * 1.5, hue),
    border: oklch(88, tint * 1.5, hue),
    borderStrong: oklch(78, tint * 2.5, hue),
    contrast: oklch(99, tint * 0.4, hue),
    steel: oklch(30, 0.035, neutralHue),
  };
}

function oklch(lightness: number, chroma: number, hue: number): string {
  return `oklch(${round(lightness)}% ${round(chroma, 4)} ${round(hue)})`;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;

  return Math.round(value * factor) / factor;
}

export type TeamSlug = keyof typeof teamConfigs;

export const defaultTeamSlug: TeamSlug = "texas-football";
export const defaultTeamConfig = teamConfigs[defaultTeamSlug];
export const enabledTeamSlugs = Object.keys(teamConfigs) as TeamSlug[];

export function getTeamConfig(slug: string): TeamConfig | undefined {
  return teamConfigs[slug as TeamSlug];
}

export function validateTeamConfig(config: TeamConfig): TeamConfig {
  return teamConfigSchema.parse(config);
}

// Reflects the real ingest surface rather than a hand-maintained list: the
// fixture and official links are produced on every ingest, while CFBD depends
// on both team config and a supplied API key.
export function getSourceReadiness(team: TeamConfig): SourceState[] {
  const states: SourceState[] = [
    {
      label: "Schedule fixture",
      state: getTeamSchedule(team.slug) ? "Ready" : "Planned",
    },
    {
      label: "Team notes (sample)",
      state: getTeamNoteDocuments(team.slug).length > 0 ? "Ready" : "Planned",
    },
    { label: "Official links", state: "Ready" },
  ];

  if (team.cfbd) {
    states.push({
      label: "CFBD adapter",
      state: process.env.CFBD_API_KEY ? "Ready" : "Needs key",
    });
  } else {
    states.push({ label: "CFBD adapter", state: "Planned" });
  }

  return states;
}
