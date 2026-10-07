// Rankings, schedules and selection announcements spell schools differently:
// "Miami (FL)", "Southern Cal", "Ole Miss". One key compares them all.
const aliases: Record<string, string> = {
  "miami fl": "miami",
  "miami florida": "miami",
  "southern cal": "usc",
  "southern california": "usc",
  "ole miss": "mississippi",
  "brigham young": "byu",
};

export function teamNameKey(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return aliases[key] ?? key;
}

export function matchesAnyName(names: readonly string[], candidate: string): boolean {
  const key = teamNameKey(candidate);
  return names.some((name) => teamNameKey(name) === key);
}
