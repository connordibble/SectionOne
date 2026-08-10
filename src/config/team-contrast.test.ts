import { describe, expect, it } from "vitest";
import {
  deriveTeamPalettes,
  teamConfigs,
  type TeamPalette,
} from "@/config/team";

type PaletteRole = keyof TeamPalette;

const bodyTextPairs: Array<[PaletteRole, PaletteRole]> = [
  ["ink", "page"],
  ["ink", "surface"],
  ["ink", "surfaceSoft"],
  ["ink", "surfaceStrong"],
  ["inkSubtle", "page"],
  ["inkSubtle", "surfaceSoft"],
  ["muted", "page"],
  ["muted", "surface"],
  ["muted", "surfaceSoft"],
  ["muted", "surfaceStrong"],
  ["accentStrong", "page"],
  ["accentStrong", "surface"],
  ["accentStrong", "surfaceStrong"],
  ["accentStrong", "surfaceSoft"],
  ["onAccent", "accent"],
  ["onSteel", "steel"],
  ["onSteel", "steelRaised"],
];

describe("derived team palette contrast", () => {
  for (const team of Object.values(teamConfigs)) {
    const palettes = deriveTeamPalettes(team.theme);

    for (const [mode, palette] of Object.entries(palettes)) {
      it(`${team.slug} ${mode} clears AA for text roles`, () => {
        for (const [foreground, background] of bodyTextPairs) {
          expect(
            contrast(palette[foreground], palette[background]),
            `${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      });

      // Field Geometry is the product's signature, and it is drawn rather than
      // written, so it is held to the 3:1 non-text bar rather than 4.5:1. The
      // route carries meaning and must separate from both the surface it sits
      // on and the grid behind it — that separation is what stops the whole
      // drawing collapsing into one grey texture, which is what it did when
      // every element shared the text colour at a single opacity.
      // Countdowns, ranks, and section numerals are set in `accent` rather than
      // the darkened `accentStrong`, so the team's real colour survives at the
      // one size where it is unmissable. They are large text, so the bar is
      // 3:1 — but it is still a bar, and a new team's hue has to clear it.
      it(`${team.slug} ${mode} keeps display figures readable in the team colour`, () => {
        for (const background of ["page", "surface", "surfaceSoft"] as const) {
          expect(
            contrast(palette.accent, palette[background]),
            `accent figure on ${background}`,
          ).toBeGreaterThanOrEqual(3);
        }
      });

      it(`${team.slug} ${mode} keeps field geometry legible on the stage`, () => {
        const surfaces: Array<[string, string]> = [
          ["stage", palette.stage],
          ["stageRaised", palette.stageRaised],
        ];

        for (const [name, surface] of surfaces) {
          expect(
            contrast(palette.graphicStrong, surface),
            `route (graphicStrong) on ${name}`,
          ).toBeGreaterThanOrEqual(3);
          expect(
            contrast(palette.graphic, surface),
            `hash marks (graphic) on ${name}`,
          ).toBeGreaterThanOrEqual(1.3);
          expect(
            contrast(palette.graphicFaint, surface),
            `grid (graphicFaint) on ${name}`,
          ).toBeGreaterThanOrEqual(1.05);
        }

        expect(
          contrast(palette.graphicStrong, palette.graphicFaint),
          "route against the grid behind it",
        ).toBeGreaterThanOrEqual(3);
      });

      it(`${team.slug} ${mode} keeps focus and masthead accents visible`, () => {
        const headerAccent = palette.headerAccent;
        const brightStructural = mode === "light" && (team.theme.structuralLightness ?? 23) > 40;
        const tabOpacity = brightStructural ? 1 : 0.58;
        const chromeOpacity = brightStructural ? 1 : 0.68;
        expect(contrast(palette.focus, palette.page), "focus on page").toBeGreaterThanOrEqual(3);
        expect(contrast(headerAccent, palette.steel), "header accent on steel").toBeGreaterThanOrEqual(
          3,
        );
        expect(
          contrastAtOpacity(palette.onSteel, palette.steel, tabOpacity),
          "inactive tab on steel",
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastAtOpacity(palette.onSteel, palette.steel, chromeOpacity),
          "issue line on steel",
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));

  return (lighter + 0.05) / (darker + 0.05);
}

function contrastAtOpacity(foreground: string, background: string, opacity: number): number {
  const backgroundLuminance = luminance(background);
  const blendedLuminance =
    luminance(foreground) * opacity + backgroundLuminance * (1 - opacity);
  const lighter = Math.max(blendedLuminance, backgroundLuminance);
  const darker = Math.min(blendedLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(color: string): number {
  const match = color.match(/^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/);

  if (!match) {
    throw new Error(`Expected an OKLCH color, received ${color}.`);
  }

  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hue = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
