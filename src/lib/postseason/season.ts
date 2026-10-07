import { z } from "zod";

const https = z.url().refine((value) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Expected an HTTPS source URL without credentials");
const day = z.iso.date();

// One season's postseason rules and confirmed outcomes, as typed data.
//
// The format has changed every year of the 12-team era, so nothing about it is
// a constant: field size, which champions get a bid, the Group of 6 rule, the
// calendar and the bowl standard all come from this file, and each block names
// the source it was checked against. Confirmed selections live here too, so a
// published field or bowl assignment supersedes every projection on the page.
export const postseasonSeasonSchema = z.object({
  season: z.number().int().min(2000).max(2200),
  checkedAt: z.iso.datetime({ offset: true }),
  sources: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), url: https })).min(1),
  playoff: z.object({
    sourceIds: z.array(z.string().min(1)).min(1),
    fieldSize: z.number().int().min(4).max(32),
    byes: z.number().int().min(0).max(16),
    // The published bracket. Listed in drawing order, top to bottom: each
    // quarterfinal names the bye seed and the first-round game that feeds it,
    // and each semifinal names the two bye seeds whose quarterfinals meet.
    // There is no re-seeding, so this fixes every path from Selection Day on.
    bracket: z.object({
      firstRound: z.array(z.tuple([z.number().int().min(1), z.number().int().min(1)])),
      quarterfinals: z.array(z.object({
        seed: z.number().int().min(1), against: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
      })),
      semifinals: z.array(z.tuple([z.number().int().min(1), z.number().int().min(1)])),
    }),
    // Champions of these conferences are in whatever their final ranking.
    championBids: z.array(z.string().min(1)).min(1),
    // The highest-ranked team from these conferences gets a bid, champion or not.
    groupBid: z.object({ label: z.string().min(1), conferences: z.array(z.string().min(1)).min(1) }),
    // Independents with a conditional automatic bid, e.g. inside the top 12.
    independentBids: z.array(z.object({ team: z.string().min(1), withinRank: z.number().int().min(1) })),
    rankings: z.array(z.object({ date: day, label: z.string().min(1) })).min(1),
    selectionDay: day,
    rounds: z.array(z.object({
      name: z.string().min(1), dates: z.array(day).min(1), sites: z.array(z.string().min(1)).min(1),
    })).min(1),
  }),
  bowls: z.object({
    sourceIds: z.array(z.string().min(1)).min(1),
    winsRequired: z.number().int().min(1),
    maxCountedFcsWins: z.number().int().min(0),
    // A longer regular season is governed by an exception this model does not
    // encode, so such a schedule reports eligibility as unknown.
    regularSeasonGames: z.number().int().min(1),
    alternates: z.object({ wins: z.number().int().min(0), losses: z.number().int().min(0), minimumApr: z.number().int() }),
  }),
  confirmed: z.object({
    playoffField: z.object({
      announcedAt: z.iso.datetime({ offset: true }), sourceUrl: https,
      seeds: z.array(z.object({
        seed: z.number().int().min(1), team: z.string().min(1), bid: z.enum(["automatic", "at-large"]),
      })),
    }).nullable(),
    bowlSelections: z.array(z.object({
      team: z.string().min(1), bowl: z.string().min(1), date: day, opponent: z.string().min(1),
      announcedAt: z.iso.datetime({ offset: true }), sourceUrl: https,
    })),
  }),
}).superRefine((season, ctx) => {
  const ids = new Set(season.sources.map((source) => source.id));
  for (const [path, list] of [["playoff", season.playoff.sourceIds], ["bowls", season.bowls.sourceIds]] as const) {
    list.forEach((id, index) => {
      if (!ids.has(id)) ctx.addIssue({ code: "custom", path: [path, "sourceIds", index], message: "Unknown source" });
    });
  }
  const dates = season.playoff.rankings.map((entry) => entry.date);
  if (dates.some((date, index) => index > 0 && date <= dates[index - 1])) {
    ctx.addIssue({ code: "custom", path: ["playoff", "rankings"], message: "Rankings dates must be in order" });
  }
  if (dates.at(-1) !== season.playoff.selectionDay) {
    ctx.addIssue({ code: "custom", path: ["playoff", "selectionDay"], message: "The final ranking is released on Selection Day" });
  }
  if (season.playoff.byes > season.playoff.fieldSize) {
    ctx.addIssue({ code: "custom", path: ["playoff", "byes"], message: "More byes than teams" });
  }
  const { bracket, byes, fieldSize } = season.playoff;
  const key = (pair: readonly number[]) => [...pair].sort((a, b) => a - b).join("-");
  const firstRound = bracket.firstRound.flat().sort((a, b) => a - b);
  const unseeded = Array.from({ length: fieldSize - byes }, (_, index) => byes + index + 1);
  if (firstRound.join() !== unseeded.join()) {
    ctx.addIssue({ code: "custom", path: ["playoff", "bracket", "firstRound"], message: "First round must hold every seed below the bye line once" });
  }
  const games = new Set(bracket.firstRound.map(key));
  const byeSeeds = bracket.quarterfinals.map((game) => game.seed).sort((a, b) => a - b);
  if (byeSeeds.join() !== Array.from({ length: byes }, (_, index) => index + 1).join()
    || bracket.quarterfinals.some((game) => !games.has(key(game.against)))
    || new Set(bracket.quarterfinals.map((game) => key(game.against))).size !== bracket.quarterfinals.length) {
    ctx.addIssue({ code: "custom", path: ["playoff", "bracket", "quarterfinals"], message: "Each bye seed meets one first-round winner" });
  }
  if (bracket.semifinals.flat().sort((a, b) => a - b).join() !== byeSeeds.join()) {
    ctx.addIssue({ code: "custom", path: ["playoff", "bracket", "semifinals"], message: "Each quarterfinal feeds one semifinal" });
  }
  const field = season.confirmed.playoffField;
  if (field) {
    const seeds = field.seeds.map((entry) => entry.seed).sort((a, b) => a - b);
    if (seeds.length !== season.playoff.fieldSize || seeds.some((seed, index) => seed !== index + 1)) {
      ctx.addIssue({ code: "custom", path: ["confirmed", "playoffField", "seeds"], message: "A confirmed field lists every seed once" });
    }
    if (new Set(field.seeds.map((entry) => entry.team.toLowerCase())).size !== field.seeds.length) {
      ctx.addIssue({ code: "custom", path: ["confirmed", "playoffField", "seeds"], message: "Duplicate team in the field" });
    }
  }
});

export type PostseasonSeason = z.infer<typeof postseasonSeasonSchema>;
export type BowlSelection = PostseasonSeason["confirmed"]["bowlSelections"][number];
export type PlayoffSeed = NonNullable<PostseasonSeason["confirmed"]["playoffField"]>["seeds"][number];
export type PlayoffBracket = PostseasonSeason["playoff"]["bracket"];
