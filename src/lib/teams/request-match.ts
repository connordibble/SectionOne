import type { TeamIdentity } from "./contract";

export type RequestTeam = Pick<TeamIdentity, "slug" | "shortName" | "displayName" | "aliases">;

// Folds case, strips accents and punctuation, and drops filler words, so
// "App State", "app-state", and "APP STATE!" group together without rewriting
// what the fan typed.
//
// It does not expand abbreviations or do fuzzy matching: "Appalachian St."
// normalizes to "appalachian st" and will not group with "app state". Counting
// demand across those spellings is a read-time problem, and guessing at it here
// would silently merge programs that only look similar.
export function normalizeTeamName(teamName: string): string {
  return teamName
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\b(university|college|the|of|at)\b/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

// Exact normalized names avoid sending Texas State fans to Texas. Shared
// aliases must identify one edition before we offer a destination.
export function findRequestedTeam(teamName: string, teams: readonly RequestTeam[]): RequestTeam | undefined {
  const normalized = normalizeTeamName(teamName);
  if (!normalized) return undefined;
  const matches = teams.filter((team) =>
    [team.shortName, team.displayName, team.slug, ...team.aliases]
      .some((name) => normalizeTeamName(name) === normalized),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
