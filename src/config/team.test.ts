import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultTeamConfig,
  defaultTeamSlug,
  enabledTeamSlugs,
  getSourceReadiness,
  getTeamConfig,
  validateTeamConfig,
} from "./team";

describe("team config", () => {
  it("exposes the Texas football deployment as the MVP default", () => {
    expect(defaultTeamSlug).toBe("texas-football");
    expect(enabledTeamSlugs).toEqual(["texas-football"]);
    expect(getTeamConfig("texas-football")?.displayName).toBe("Texas football");
  });

  it("keeps legal and voice guardrails in config", () => {
    const config = validateTeamConfig(defaultTeamConfig);

    expect(config.sourcePolicy.disclaimer).toContain("not affiliated");
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
      expect.objectContaining({ id: "notes", label: "Desk notes", state: "Ready" }),
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
