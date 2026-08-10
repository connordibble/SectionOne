import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamNoteDocuments } from "@/server/sources/notes";
import {
  defaultTeamConfig,
  houseTheme,
  defaultTeamSlug,
  deriveTeamPalette,
  enabledTeamSlugs,
  getSourceReadiness,
  getTeamConfig,
  validateTeamConfig,
} from "./team";

function lightnessOf(color: string): number {
  const match = /^oklch\(([\d.]+)%/.exec(color);

  if (!match) {
    throw new Error(`Not an oklch colour: ${color}`);
  }

  return Number(match[1]);
}

function parseOklch(color: string): { lightness: number; chroma: number; hue: number } {
  const match = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(color);

  if (!match) {
    throw new Error(`Not an oklch colour: ${color}`);
  }

  return {
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  };
}

describe("team config", () => {
  it("exposes Texas football as the default team", () => {
    expect(defaultTeamSlug).toBe("texas-football");
    expect(enabledTeamSlugs).toContain("texas-football");
    expect(getTeamConfig("texas-football")?.displayName).toBe("Texas football");
  });

  it("ships a second edition outside the blue-blood tier", () => {
    const utahState = getTeamConfig("utah-state-football");

    expect(utahState?.displayName).toBe("Utah State football");
    expect(utahState?.conference).toBe("Pac-12");
    expect(utahState?.aliases).toContain("Aggies");
  });

  // If two editions ever share an accent hue the product looks like one site
  // with two names, which is the failure mode the config seam exists to stop.
  it("gives every edition its own accent hue", () => {
    const hues = enabledTeamSlugs.map((slug) => getTeamConfig(slug)!.theme.hue);

    expect(new Set(hues).size).toBe(hues.length);
  });

  it("keeps the Texas edition visually distinct from the house theme", () => {
    expect(defaultTeamConfig.theme.structuralHue).not.toBe(houseTheme.structuralHue);
    expect(defaultTeamConfig.theme.structuralChroma).toBeGreaterThan(
      houseTheme.structuralChroma,
    );
    expect(defaultTeamConfig.theme.chroma).toBeGreaterThan(houseTheme.chroma);
  });

  // The chrome is always a restrained dark, in both themes and for every team.
  // It frames the issue; it is never the team's signature colour. A team that
  // declares a bright structural lightness is describing its *stage*, not its
  // masthead — putting a school's brightest colour behind the navigation is
  // what made the Texas edition read as one flat orange rectangle.
  it("keeps chrome restrained and separate from the stage", () => {
    for (const slug of enabledTeamSlugs) {
      const team = getTeamConfig(slug)!;

      for (const mode of ["light", "dark"] as const) {
        const palette = deriveTeamPalette(team.theme, mode);

        expect(lightnessOf(palette.steel), `${slug} ${mode} steel`).toBeLessThanOrEqual(30);
        expect(
          lightnessOf(palette.steelRaised),
          `${slug} ${mode} steel-raised`,
        ).toBeLessThanOrEqual(32);
        expect(lightnessOf(palette.onSteel), `${slug} ${mode} on-steel`).toBeGreaterThanOrEqual(90);

        // A header painted the same value as the surface directly beneath it
        // reads as a rendering bug rather than as structure.
        expect(
          Math.abs(lightnessOf(palette.stage) - lightnessOf(palette.steel)),
          `${slug} ${mode} stage vs steel separation`,
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  // Dark mode still belongs to the team. Washing an edition to neutral grey
  // after dark is the failure this guards: the stage keeps real chroma, and it
  // stays in the team's own hue rather than drifting to a house colour.
  it("keeps the team's colour on the stage in dark mode", () => {
    for (const slug of enabledTeamSlugs) {
      const team = getTeamConfig(slug)!;
      const dark = deriveTeamPalette(team.theme, "dark");
      const stage = parseOklch(dark.stage);

      expect(stage.chroma, `${slug} dark stage chroma`).toBeGreaterThanOrEqual(0.04);
      expect(
        Math.abs(stage.hue - team.theme.structuralHue),
        `${slug} dark stage hue drift`,
      ).toBeLessThanOrEqual(1);
    }
  });

  // Warm hues turn brown below roughly L35 — that is what a dark orange is.
  // The chrome therefore holds only as much chroma as its hue can carry, and
  // the team's colour is delivered by the stage and the accent instead.
  it("does not let a warm chrome turn muddy", () => {
    for (const slug of enabledTeamSlugs) {
      const team = getTeamConfig(slug)!;
      const warm =
        Math.cos(((team.theme.structuralHue - 60) * Math.PI) / 180) > 0.35;

      if (!warm) {
        continue;
      }

      for (const mode of ["light", "dark"] as const) {
        expect(
          parseOklch(deriveTeamPalette(team.theme, mode).steel).chroma,
          `${slug} ${mode} warm chrome chroma`,
        ).toBeLessThanOrEqual(0.025);
      }
    }
  });

  // Every promoted prompt has to resolve to a real note or the workspace
  // offers a question its own sources cannot answer.
  it("points every editorial reference at a note the team actually ships", () => {
    for (const slug of enabledTeamSlugs) {
      const team = getTeamConfig(slug)!;
      const noteIds = new Set(
        getTeamNoteDocuments(slug).map((document) => String(document.metadata.noteId)),
      );

      const referenced = [
        team.editorial.lead.noteId,
        ...team.editorial.matchup.citationNoteIds,
        ...team.editorial.signals.map((signal) => signal.noteId),
      ];

      for (const noteId of referenced) {
        expect(noteIds, `${slug} references a missing note: ${noteId}`).toContain(noteId);
      }
    }
  });

  it("keeps legal and voice guardrails in config", () => {
    const config = validateTeamConfig(defaultTeamConfig);

    expect(config.sourcePolicy.disclaimer).toMatch(/not affiliated/i);
    expect(config.sourcePolicy.protectedMarksGuidance).toContain(
      "Do not use Bevo as product branding.",
    );
    expect(config.voice.preferredTerms).toContain("line of scrimmage");
    expect(config.voice.bannedPhrases).toContain("as an AI");
  });
});

describe("source readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks schedule, notes, and official links ready and keeps statistics planned", () => {
    vi.stubEnv("CFBD_API_KEY", "");
    const states = getSourceReadiness(defaultTeamConfig);

    expect(states).toContainEqual(
      expect.objectContaining({ id: "schedule", label: "Schedule", state: "Ready" }),
    );
    expect(states).toContainEqual(
      expect.objectContaining({ id: "notes", label: "Matchup notes", state: "Ready" }),
    );
    expect(states).toContainEqual(
      expect.objectContaining({ id: "official", label: "Official links", state: "Ready" }),
    );
    expect(states).toContainEqual(
      expect.objectContaining({
        id: "statistics",
        label: "Season statistics",
        state: "Planned",
      }),
    );
  });

  it("marks season statistics ready when a key is present", () => {
    vi.stubEnv("CFBD_API_KEY", "test-key");
    const states = getSourceReadiness(defaultTeamConfig);

    expect(states).toContainEqual(
      expect.objectContaining({
        id: "statistics",
        label: "Season statistics",
        state: "Ready",
      }),
    );
  });
});
