// Published web hex values are sRGB. Convert them without changing lightness
// or saturation; the shared palette can then derive its accessible UI roles.
export function hexToOklch(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error("Expected a six-digit web color");
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * 100;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const c = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, c);
  return { lightness, chroma: chroma < 0.000001 ? 0 : chroma,
    hue: chroma < 0.000001 ? 0 : (Math.atan2(c, a) * 180 / Math.PI + 360) % 360 };
}

export function brandColor(hex: string): string {
  const { lightness, chroma, hue } = hexToOklch(hex);
  return `oklch(${lightness.toFixed(6)}% ${chroma.toFixed(6)} ${hue.toFixed(6)})`;
}
