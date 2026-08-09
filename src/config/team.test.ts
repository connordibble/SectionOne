import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamNoteDocuments } from "@/server/sources/notes";
import {
  defaultTeamConfig,
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

  // A team whose own primary is dark puts that colour in the masthead, so the
  // structural hue is allowed to equal the accent hue. What is not allowed is
  // a structural colour too light to carry the text sitting on it — that is
  // the one way honouring a school's colours can break the interface.
  it("keeps every structural dark dark enough for the text on it", () => {
    for (const slug of enabledTeamSlugs) {
      for (const mode of ["light", "dark"] as const) {
        const palette = deriveTeamPalette(getTeamConfig(slug)!.theme, mode);

        expect(lightnessOf(palette.steel), `${slug} ${mode} steel`).toBeLessThanOrEqual(30);
        expect(lightnessOf(palette.steelRaised), `${slug} ${mode} steel-raised`).toBeLessThanOrEqual(
          32,
        );
        expect(lightnessOf(palette.onSteel), `${slug} ${mode} on-steel`).toBeGreaterThanOrEqual(90);
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
