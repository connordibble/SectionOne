import { z } from "zod";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { getTeamNoteDocuments } from "@/server/sources/notes";

export type SourceReadinessState = "Ready" | "Planned";
export type SourceState = {
  id: "schedule" | "notes" | "official" | "statistics";
  label: string;
  description: string;
  state: SourceReadinessState;
};

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
  editorial: z.object({
    lead: z.object({
      headline: z.string().min(1),
      body: z.string().min(1),
      noteId: z.string().min(1),
    }),
    matchup: z.object({
      thesis: z.string().min(1),
      question: z.string().min(1),
      answer: z.string().min(1),
      citationNoteIds: z.array(z.string().min(1)).min(1),
    }),
    signals: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          summary: z.string().min(1),
          detail: z.string().min(1),
          state: z.enum(["watch", "ready", "thin"]),
          prompt: z.string().min(1),
          noteId: z.string().min(1),
        }),
      )
      .length(4),
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
    referenceLabel: "Texas · Week 1 · 2026",
    tagline: "Get the short answer before kickoff.",
    aliases: ["Texas", "Longhorns", "UT Austin"],
    // The structural colour is Texas burnt orange itself, not a stand-in.
    //
    // oklch(57.8% 0.1545 49.2) is the measured conversion of the school's
    // published burnt orange, which is why it matches the accent anchors above:
    // one colour doing two jobs. Two earlier attempts were both wrong for the
    // same reason — they answered "what goes next to orange" instead of "what
    // is this team's colour." A navy counterweight put a rival's colour on the
    // page, and taking the orange down to a structural lightness only made it
    // chocolate. A bright primary is allowed to be the structure; that is what
    // `structuralLightness` is for.
    theme: {
      hue: 49.2,
      chroma: 0.155,
      structuralHue: 49.2,
      structuralChroma: 0.1545,
      structuralLightness: 57.8,
    },
    sourcePolicy: {
      disclaimer:
        "Independent coverage. Not affiliated with Texas Athletics.",
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
    editorial: {
      lead: {
        headline: "Start clean. Win up front.",
        body:
          "Watch the pace, tackling, and who earns real snaps. The interior line is still the biggest question.",
        noteId: "opponent-texas-state",
      },
      matchup: {
        thesis: "Win up front",
        question: "How does Texas take control early?",
        answer:
          "Watch first and second down. If Texas stays ahead of the sticks and wins up front, the whole offense opens up.",
        citationNoteIds: ["early-down-identity", "opponent-texas-state"],
      },
      signals: [
        {
          id: "early-downs",
          title: "Early downs",
          summary: "Stay ahead of the sticks",
          detail:
            "First and second down matter more than raw yards. Too many third-and-longs mean trouble.",
          state: "watch",
          prompt: "What should I watch on early downs?",
          noteId: "early-down-identity",
        },
        {
          id: "clean-operation",
          title: "Clean operation",
          summary: "Clean snaps. No free yards.",
          detail:
            "Get the call in, snap it on time, and protect the ball. Do not let mistakes flip the field.",
          state: "watch",
          prompt: "What does a clean start look like for Texas?",
          noteId: "quarterback-operation",
        },
        {
          id: "pressure-four",
          title: "Pressure with four",
          summary: "Get home without blitzing",
          detail:
            "Interior pressure lets Texas hurry the quarterback without giving up help in coverage.",
          state: "ready",
          prompt: "Why does pressure with four matter?",
          noteId: "defensive-front-pressure",
        },
        {
          id: "interior-rotation",
          title: "Interior line",
          summary: "Find the best five",
          detail:
            "Guard is still unsettled. Short yardage and interior pressure should reveal who the staff trusts.",
          state: "thin",
          prompt: "What should I watch on the interior line?",
          noteId: "interior-ol-rotation",
        },
      ],
    },
    nextGameNote:
      "Watch early downs, clean snaps, and who wins up front before the schedule gets harder.",
    cfbd: {
      team: "Texas",
      season: 2026,
    },
    suggestedPrompts: [
      "What matters on early downs?",
      "Who does Texas play next?",
    ],
  }),
  "utah-state-football": teamConfigSchema.parse({
    slug: "utah-state-football",
    sport: "football",
    league: "college-football",
    conference: "Pac-12",
    displayName: "Utah State football",
    shortName: "Utah State",
    referenceLabel: "Utah State · Week 1 · 2026",
    tagline: "Get the short answer before kickoff.",
    aliases: ["Utah State", "Aggies", "USU"],
    // Aggie blue on white. The school's primary is already a dark navy, so it
    // is the structural dark — the masthead is the team's actual colour rather
    // than a neutral standing in for it. Measured against the published navy,
    // which lands at oklch(25% 0.056 237); the structural slot sits at L23, so
    // the bar reads as the real thing.
    //
    // The accent is the same blue lifted to a lightness that can carry text
    // and figures on a pale page. One hue family, two jobs.
    theme: {
      hue: 250,
      chroma: 0.12,
      structuralHue: 250,
      structuralChroma: 0.06,
    },
    sourcePolicy: {
      disclaimer: "Independent coverage. Not affiliated with Utah State Athletics.",
      trustedSourceLabels: [
        "CollegeFootballData",
        "Official schedule links",
        "Verified game notes",
      ],
      protectedMarksGuidance: [
        "Do not use official logos or mascot imagery.",
        "Do not use Big Blue as product branding.",
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
        "special teams",
        "hidden yardage",
        "third down",
        "success rate",
      ],
      bannedPhrases: [
        "as an AI",
        "it is important to note",
        "official partner",
        "guaranteed lock",
        // The register smaller programs get written in everywhere else, and
        // the reason a fan of one has no good reading options. A team that is
        // not a national story is not thereby a human interest story.
        "little brother",
        "plucky",
        "cinderella",
        "punching above",
      ],
    },
    editorial: {
      lead: {
        headline: "Bank the opener. The road comes fast.",
        body: "Idaho State first, then Seattle and Salt Lake City in back-to-back weeks. Watch tackling in space and who wins early downs.",
        noteId: "opponent-idaho-state",
      },
      matchup: {
        thesis: "Win the margins",
        question: "How does Utah State stay in games in the Pac-12?",
        answer:
          "Field position and explosive plays. Win special teams, give up nothing behind coverage, and the roster gap stops deciding it by itself.",
        citationNoteIds: ["special-teams-margin", "explosive-plays-allowed"],
      },
      signals: [
        {
          id: "run-game",
          title: "Run game",
          summary: "Stay ahead of the chains",
          detail:
            "First and second down decide whether this offense gets to use the rest of its playbook. Third-and-long is where the drive ends.",
          state: "watch",
          prompt: "What matters in the run game?",
          noteId: "run-game-identity",
        },
        {
          id: "ball-security",
          title: "Ball security",
          summary: "Make them drive the field",
          detail:
            "Get the call in, take the checkdown, and hand nothing over for free. Field position is worth more here than one big throw.",
          state: "watch",
          prompt: "What does a clean start look like for Utah State?",
          noteId: "quarterback-operation",
        },
        {
          id: "explosive-plays",
          title: "Explosive plays",
          summary: "Nothing behind coverage",
          detail:
            "Long, slow drives against this defense are survivable. Chunk plays over the top are what turn a close game into a bad one.",
          state: "ready",
          prompt: "Why do explosive plays decide these games?",
          noteId: "explosive-plays-allowed",
        },
        {
          id: "special-teams",
          title: "Special teams",
          summary: "Cheapest yards on the field",
          detail:
            "Net punting and kick coverage are where a roster without a talent edge buys itself a quarter of football.",
          state: "thin",
          prompt: "What should I watch on special teams?",
          noteId: "special-teams-margin",
        },
      ],
    },
    nextGameNote:
      "Watch tackling in space, early downs, and who earns real snaps up front before the trip to Seattle.",
    cfbd: {
      team: "Utah State",
      season: 2026,
    },
    suggestedPrompts: [
      "What matters in the run game?",
      "Who does Utah State play next?",
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
  headerAccent: string;
  // Field Geometry's own ink. The signature view draws on the structural dark,
  // where neither the accent (too dark to read on it) nor the text colour (grey,
  // and identical for every team) can carry a route. These three are the drawing
  // palette: grid, secondary structure, and the line that means something.
  graphicFaint: string;
  graphic: string;
  graphicStrong: string;
  // The one surface that wears the team's actual colour: the hero game object
  // and the Matchup board. Separate from `steel` because the masthead and the
  // stage must not be the same value — a header painted the same colour as the
  // surface directly under it reads as a mistake rather than as structure.
  stage: string;
  stageRaised: string;
  onStage: string;
  muted: string;
  border: string;
  borderStrong: string;
  onAccent: string;
  steel: string;
  steelRaised: string;
  onSteel: string;
  focus: string;
};

export type TeamPaletteSet = {
  light: TeamPalette;
  dark: TeamPalette;
};

// Shared lightness and chroma relationships for both modes. OKLCH makes the
// palette predictable as hue rotates, but perceptual uniformity is not a
// substitute for WCAG measurement; enabled team palettes are audited against
// the rendered foreground/background pairs before release.
export function deriveTeamPalette(
  theme: TeamConfig["theme"],
  mode: "light" | "dark" = "light",
): TeamPalette {
  const { hue, chroma, structuralHue, structuralChroma } = theme;
  const structuralLightness = theme.structuralLightness ?? 23;
  const brightStructural = structuralLightness > 40;

  // Surfaces and text carry a trace of the team hue so the page reads warm (or
  // cool) rather than grey, but at a chroma low enough to stay neutral.
  const tint = Math.min(chroma * 0.09, 0.014);

  // Chrome chroma, and the reason dark mode is not brown.
  //
  // A dark surface cannot carry a warm hue at real saturation. Orange, red, and
  // yellow all become brown, maroon, or olive below roughly L35 — that is what
  // dark orange *is*, not a mistake in the conversion. Cool hues do not have
  // this problem: navy at the same lightness still reads as navy.
  //
  // So the chrome takes the team's hue but only as much chroma as that hue can
  // hold while staying recognisable, and the team's real colour is carried by
  // the stage, the accent, and the field graphics instead. A warm team reads as
  // warm because everything on the page is warm, not because the header is mud.
  const warmth = Math.cos(((structuralHue - 60) * Math.PI) / 180);
  const chromeChroma = Math.min(structuralChroma, warmth > 0.35 ? 0.022 : 0.062);

  // Where the stage lands in this mode, and the drawing palette that follows
  // from it. Field Geometry is drawn *on* the stage, so its ladder has to be
  // derived from the stage rather than fixed: a burnt-orange stage at L58 and
  // an Aggie-navy one at L21 cannot share one set of line colours.
  //
  // On a light stage the grid is chalk — lighter than the surface — and the
  // route is a dark line over it. On a dark stage both run the other way. The
  // grid deliberately sits nearer the surface than the route does, because the
  // route is the element carrying meaning and has to win.
  const stageLightness =
    mode === "dark"
      ? brightStructural
        ? structuralLightness - 12
        : structuralLightness - 2
      : structuralLightness;
  const stageRaisedLightness =
    mode === "dark"
      ? brightStructural
        ? structuralLightness - 19
        : structuralLightness + 4
      : brightStructural
        ? structuralLightness - 7
        : structuralLightness + 6;
  // Only a light stage in light mode gets a dark route. After dark the route
  // always runs brighter than the surface: a dark line on a mid-tone stage on
  // a dark page has nowhere to go, and chalk-bright reads better anyway.
  const inkedRoute = mode === "light" && stageLightness >= 45;
  const clamp = (value: number) => Math.min(94, Math.max(8, value));
  const graphicFaintLightness = clamp(stageLightness + (inkedRoute ? 13 : 11));
  const graphicLightness = clamp(stageLightness + (inkedRoute ? 24 : 23));
  const graphicStrongLightness = clamp(stageLightness + (inkedRoute ? -46 : 47));

  if (mode === "dark") {
    return {
      page: oklch(13.5, tint * 0.65, hue),
      surface: oklch(16.5, tint * 0.75, hue),
      surfaceSoft: oklch(20.5, tint * 0.9, hue),
      surfaceStrong: oklch(26, tint * 1.1, hue),
      ink: oklch(94, tint * 0.35, hue),
      inkSubtle: oklch(82, tint * 0.45, hue),
      accent: oklch(70, chroma * 0.82, hue),
      accentStrong: oklch(80, chroma * 0.68, hue),
      accentSoft: oklch(34, chroma * 0.52, hue),
      headerAccent: oklch(80, chroma * 0.68, hue),
      graphicFaint: oklch(graphicFaintLightness, tint * 2.2, hue),
      graphic: oklch(graphicLightness, chroma * 0.34, hue),
      graphicStrong: oklch(graphicStrongLightness, chroma * 0.85, hue),
      // Dark mode keeps the team's colour on the stage rather than washing the
      // whole page to grey. A bright primary is pulled down just enough to sit
      // under light type; a primary that is already dark is lifted off the
      // page so it still reads as a surface.
      stage: oklch(stageLightness, structuralChroma * 0.9, structuralHue),
      stageRaised: oklch(stageRaisedLightness, structuralChroma * 0.82, structuralHue),
      onStage: oklch(97, 0.008, structuralHue),
      muted: oklch(70, tint * 0.55, hue),
      border: oklch(29, tint * 0.8, hue),
      borderStrong: oklch(43, tint * 0.9, hue),
      onAccent: oklch(15, tint * 0.8, hue),
      steel: oklch(10.5, chromeChroma * 0.7, structuralHue),
      steelRaised: oklch(16.5, chromeChroma * 0.85, structuralHue),
      onSteel: oklch(94, 0.012, structuralHue),
      focus: oklch(84, chroma * 0.58, hue),
    };
  }

  return {
    page: oklch(96.5, tint, hue),
    surface: oklch(98.5, tint * 0.6, hue),
    surfaceSoft: oklch(93.5, tint * 1.6, hue),
    surfaceStrong: oklch(88, tint * 2.4, hue),
    ink: oklch(20, tint * 1.1, hue),
    inkSubtle: oklch(32, tint * 1.2, hue),
    accent: oklch(49, chroma, hue),
    accentStrong: oklch(38, chroma * 0.96, hue),
    accentSoft: oklch(82, chroma * 0.54, hue),
    headerAccent: brightStructural ? oklch(100, 0, structuralHue) : oklch(82, chroma * 0.54, hue),
    graphicFaint: oklch(graphicFaintLightness, tint * 2.2, hue),
    graphic: oklch(graphicLightness, chroma * 0.34, hue),
    graphicStrong: oklch(graphicStrongLightness, chroma * 0.85, hue),
    muted: oklch(43, tint * 1.5, hue),
    border: oklch(86, tint * 1.5, hue),
    borderStrong: oklch(72, tint * 2.5, hue),
    onAccent: oklch(98.5, tint * 0.4, hue),
    // Chrome is always a restrained dark, never the team's signature colour.
    // It is the frame around the issue; the stage below it is the issue.
    steel: oklch(19, chromeChroma, structuralHue),
    steelRaised: oklch(26, chromeChroma * 1.1, structuralHue),
    onSteel: oklch(96, 0.012, structuralHue),
    stage: oklch(stageLightness, structuralChroma, structuralHue),
    stageRaised: oklch(stageRaisedLightness, structuralChroma * 0.94, structuralHue),
    onStage: brightStructural ? oklch(100, 0, structuralHue) : oklch(97, 0.01, structuralHue),
    focus: oklch(34, chroma * 0.88, hue),
  };
}

export function deriveTeamPalettes(theme: TeamConfig["theme"]): TeamPaletteSet {
  return {
    light: deriveTeamPalette(theme, "light"),
    dark: deriveTeamPalette(theme, "dark"),
  };
}

// Section One's own identity, used by surfaces that belong to the product
// rather than to any one edition. It matches the global accent in tokens.css.
//
// Texas currently shares this hue because Texas is burnt orange; that is a
// coincidence, not a coupling. When an edition ships in green or blue, the
// house surfaces stay orange.
export const houseTheme: TeamConfig["theme"] = {
  hue: 47,
  chroma: 0.13,
  structuralHue: 236,
  structuralChroma: 0.035,
};

const paletteRoles: Array<[string, keyof TeamPalette]> = [
  ["page", "page"],
  ["surface", "surface"],
  ["surface-soft", "surfaceSoft"],
  ["surface-strong", "surfaceStrong"],
  ["ink", "ink"],
  ["ink-subtle", "inkSubtle"],
  ["muted", "muted"],
  ["border", "border"],
  ["border-strong", "borderStrong"],
  ["accent", "accent"],
  ["accent-strong", "accentStrong"],
  ["accent-soft", "accentSoft"],
  ["header-accent", "headerAccent"],
  ["graphic-faint", "graphicFaint"],
  ["graphic", "graphic"],
  ["graphic-strong", "graphicStrong"],
  ["on-accent", "onAccent"],
  ["steel", "steel"],
  ["steel-raised", "steelRaised"],
  ["on-steel", "onSteel"],
  ["stage", "stage"],
  ["stage-raised", "stageRaised"],
  ["on-stage", "onStage"],
  ["focus", "focus"],
];

// Emits both modes as --team-light-* / --team-dark-* custom properties. The
// `.team-theme` class in tokens.css bridges whichever mode is active onto the
// live --team-* roles that components actually consume.
export function createThemeStyle(theme: TeamConfig["theme"]): Record<string, string> {
  const palettes = deriveTeamPalettes(theme);
  const customProperties: Record<string, string> = {};
  const brightStructural = (theme.structuralLightness ?? 23) > 40;

  for (const mode of ["light", "dark"] as const) {
    for (const [cssRole, paletteRole] of paletteRoles) {
      customProperties[`--team-${mode}-${cssRole}`] = palettes[mode][paletteRole];
    }

    customProperties[`--team-${mode}-tab-opacity`] =
      mode === "light" && brightStructural ? "1" : "0.58";
    customProperties[`--team-${mode}-chrome-opacity`] =
      mode === "light" && brightStructural ? "1" : "0.82";
  }

  return customProperties;
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
// schedule and official links are produced on every ingest, while statistics depend
// on both team config and a supplied API key.
export function getSourceReadiness(team: TeamConfig): SourceState[] {
  const states: SourceState[] = [
    {
      id: "schedule",
      label: "Schedule",
      description: "Dates, kickoff windows, venues, and broadcast assignments.",
      state: getTeamSchedule(team.slug) ? "Ready" : "Planned",
    },
    {
      id: "notes",
      label: "Matchup notes",
      description: "Independent reads on the team and opponent.",
      state: getTeamNoteDocuments(team.slug).length > 0 ? "Ready" : "Planned",
    },
    {
      id: "official",
      label: "Official links",
      description: "Team pages for schedules and game details.",
      state: "Ready",
    },
  ];

  if (team.cfbd) {
    states.push({
      id: "statistics",
      label: "Season statistics",
      description: "Team and opponent numbers for deeper comparisons.",
      state: process.env.CFBD_API_KEY ? "Ready" : "Planned",
    });
  } else {
    states.push({
      id: "statistics",
      label: "Season statistics",
      description: "Team and opponent numbers for deeper comparisons.",
      state: "Planned",
    });
  }

  return states;
}
