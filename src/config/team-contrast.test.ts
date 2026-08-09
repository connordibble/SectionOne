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

      it(`${team.slug} ${mode} keeps focus and masthead accents visible`, () => {
        const headerAccent = mode === "light" ? palette.accentSoft : palette.accentStrong;

        expect(contrast(palette.focus, palette.page), "focus on page").toBeGreaterThanOrEqual(3);
        expect(contrast(headerAccent, palette.steel), "header accent on steel").toBeGreaterThanOrEqual(
          3,
        );
        expect(
          contrastAtOpacity(palette.onSteel, palette.steel, 0.58),
          "inactive tab on steel",
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastAtOpacity(palette.onSteel, palette.steel, 0.68),
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
