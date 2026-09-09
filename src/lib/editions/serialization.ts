// Keep established object key order so a correction does not rewrite unrelated
// fields. Values still come exclusively from the validated candidate.
export function preserveKeyOrder(value: unknown, previous: unknown): unknown {
  if (Array.isArray(value)) return value.map((item, index) => preserveKeyOrder(item, Array.isArray(previous) ? previous[index] : undefined));
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  const old = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {};
  const keys = [...new Set([...Object.keys(old), ...Object.keys(object)])].filter((key) => Object.hasOwn(object, key));
  return Object.fromEntries(keys.map((key) => [key, preserveKeyOrder(object[key], old[key])]));
}
