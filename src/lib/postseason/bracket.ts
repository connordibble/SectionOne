import { matchesAnyName } from "@/lib/facts/team-names";
import type { PostseasonSeason } from "./season";

// A slot is either a seed (with its team once the field is set) or the winner
// of an earlier game, named by the seeds that could arrive there.
export type BracketSlot = {
  seed?: number;
  team?: string;
  from?: number[];
  // The edition's own team, once the field is set.
  isTeam?: boolean;
};

export type BracketGame = {
  id: string;
  slots: [BracketSlot, BracketSlot];
  // Games the edition's team plays in, or would reach by winning.
  onRoad?: boolean;
};

export type BracketRound = {
  name: string;
  dates: string[];
  sites: string[];
  games: BracketGame[];
};

const byName = (season: PostseasonSeason, name: string) =>
  season.playoff.rounds.find((round) => round.name.toLowerCase() === name.toLowerCase());

// Draws the season's published bracket in drawing order: quarterfinals are
// grouped by the semifinal they feed, and first-round games line up with the
// quarterfinal they feed. Nothing here projects a seed. Before Selection Day
// every slot is a seed number; after it, the announced teams fill them.
export function buildBracket(season: PostseasonSeason, teamNames: readonly string[] = []): BracketRound[] {
  const { bracket } = season.playoff;
  const field = season.confirmed.playoffField;
  const teamAt = (seed: number) => field?.seeds.find((entry) => entry.seed === seed)?.team;
  const teamSeed = field?.seeds.find((entry) => matchesAnyName(teamNames, entry.team))?.seed;
  const slot = (seed: number): BracketSlot => {
    const team = teamAt(seed);
    return { seed, ...(team ? { team } : {}), ...(teamSeed === seed ? { isTeam: true } : {}) };
  };
  const winner = (seeds: number[]): BracketSlot => ({ from: [...seeds].sort((a, b) => a - b) });
  const holds = (seeds: number[]) => teamSeed !== undefined && seeds.includes(teamSeed);

  const quarterfinals = bracket.semifinals.flat().map((seed) => bracket.quarterfinals.find((game) => game.seed === seed)!);
  const firstRound = quarterfinals.map((game) => [...game.against].sort((a, b) => a - b) as [number, number]);
  const quarterSeeds = (game: (typeof quarterfinals)[number]) => [game.seed, ...game.against];
  const semifinalSeeds = bracket.semifinals.map((pair) => pair.flatMap((seed) => quarterSeeds(quarterfinals.find((game) => game.seed === seed)!)));

  const round = (key: string, games: BracketGame[]): BracketRound => {
    const entry = byName(season, key);
    return { name: entry?.name ?? key, dates: entry?.dates ?? [], sites: entry?.sites ?? [], games };
  };
  return [
    round("First round", firstRound.map(([higher, lower]) => ({
      id: `first-${higher}-${lower}`, slots: [slot(higher), slot(lower)], onRoad: holds([higher, lower]) || undefined,
    }))),
    round("Quarterfinals", quarterfinals.map((game) => ({
      id: `quarter-${game.seed}`, slots: [slot(game.seed), winner(game.against)], onRoad: holds(quarterSeeds(game)) || undefined,
    }))),
    round("Semifinals", bracket.semifinals.map((pair, index) => ({
      id: `semi-${pair.join("-")}`,
      slots: pair.map((seed) => winner(quarterSeeds(quarterfinals.find((game) => game.seed === seed)!))) as [BracketSlot, BracketSlot],
      onRoad: holds(semifinalSeeds[index]) || undefined,
    }))),
    round("National championship", [{
      id: "final", slots: [winner(semifinalSeeds[0]), winner(semifinalSeeds[1] ?? [])], onRoad: teamSeed !== undefined || undefined,
    }]),
  ];
}
