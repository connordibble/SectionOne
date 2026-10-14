import { describe, expect, it } from "vitest";
import { brandColor, hexToOklch } from "./brand-color";
import { deriveTeamPalettes, teamConfigs } from "@/config/team";

describe("official team color anchors", () => {
  it("converts sRGB endpoints without tinting neutral colors", () => {
    expect(hexToOklch("#000000")).toEqual({ lightness: 0, chroma: 0, hue: 0 });
    expect(hexToOklch("#FFFFFF").lightness).toBeCloseTo(100, 5);
    expect(hexToOklch("#FFFFFF").chroma).toBe(0);
    expect(() => hexToOklch("orange")).toThrow();
  });
  it("preserves every verified primary unchanged in both themes", () => {
    for (const team of Object.values(teamConfigs)) {
      expect(team.theme.brand, team.slug).toBeDefined();
      const palette = deriveTeamPalettes(team.theme);
      expect(palette.light.stage).toBe(brandColor(team.theme.brand!.primary));
      expect(palette.dark.stage).toBe(palette.light.stage);
    }
  });
  it("keeps Tennessee orange distinct from Texas burnt orange", () => {
    expect(teamConfigs["tennessee-football"].theme.brand?.primary).toBe("#FF8200");
    expect(teamConfigs["texas-football"].theme.brand?.primary).toBe("#BF5700");
    const tennessee = hexToOklch("#FF8200");
    const texas = hexToOklch("#BF5700");
    expect(tennessee.lightness - texas.lightness).toBeGreaterThan(15);
  });
});
