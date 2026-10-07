import type { BowlOutlook, PlayoffOutlook, SeasonRecord, TeamPostseason } from "./outlook";

// Fan-facing wording for postseason states, shared by the edition section and
// the playoff page so one state never reads two ways. Plain words, no odds:
// nothing here estimates a chance of anything.

const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (value: number) => words[value] ?? String(value);
const capitalized = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// "Tue, Nov 3". ISO calendar dates are rendered in UTC so they never shift a day.
export function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}

export function recordLabel(record: Pick<SeasonRecord, "wins" | "losses">): string {
  return `${record.wins}-${record.losses}`;
}

export function recordDetail(record: SeasonRecord): string {
  const parts = [recordLabel(record)];
  if (record.remainingGames) parts.push(`${record.remainingGames} ${record.remainingGames === 1 ? "game" : "games"} left`);
  else parts.push("regular season complete");
  if (record.pendingResults) parts.push(`${record.pendingResults} ${record.pendingResults === 1 ? "result" : "results"} pending`);
  return parts.join(" · ");
}

function seedLine(playoff: PlayoffOutlook): string {
  const seed = playoff.seed!.seed;
  if (seed <= playoff.byes) return `No. ${seed} seed with a first-round bye.`;
  const opponent = playoff.fieldSize + playoff.byes + 1 - seed;
  return seed <= (playoff.fieldSize + playoff.byes) / 2
    ? `No. ${seed} seed, hosting No. ${opponent} in the first round.`
    : `No. ${seed} seed, at No. ${opponent} in the first round.`;
}

export function playoffLine(playoff: PlayoffOutlook, record: SeasonRecord): string {
  if (playoff.standing === "in-field") return seedLine(playoff);
  if (playoff.standing === "not-selected") return "Not in the field. The bracket was set on Selection Day.";
  if (playoff.phase === "rankings") {
    if (playoff.committeeRank === null) return "Not in the committee's top 25.";
    const line = playoff.committeeRank <= playoff.fieldSize ? `inside the top ${playoff.fieldSize}` : `outside the top ${playoff.fieldSize}`;
    return `No. ${playoff.committeeRank} in the committee's top 25, ${line}.`;
  }
  const poll = playoff.apRank ? `No. ${playoff.apRank} in the AP poll` : playoff.apRank === null ? "Unranked in the AP poll" : "AP poll unavailable";
  const losses = record.losses === 0 ? "unbeaten" : `${count(record.losses)} ${record.losses === 1 ? "loss" : "losses"}`;
  return `${poll}, ${losses}. ${playoff.standing === "in-picture" ? "In the picture." : "Outside the picture."}`;
}

export function pathLine(playoff: PlayoffOutlook): string {
  const atLarge = `a top-${playoff.fieldSize} finish`;
  switch (playoff.path) {
    case "champion": return `Win the ${playoff.conference} and the bid is automatic, whatever the ranking. Otherwise ${atLarge} for an at-large spot.`;
    case "group": return `Finish as the highest-ranked ${playoff.groupLabel} team, champion or not. Otherwise ${atLarge} for an at-large spot.`;
    case "independent": return `${capitalized(atLarge)} in the final rankings carries an automatic bid.`;
    default: return `${capitalized(atLarge)} in the final rankings for an at-large spot.`;
  }
}

export function bowlLine(bowl: BowlOutlook): string {
  const fcsNote = bowl.extraFcsWins ? ` Only one FCS win counts toward that.` : "";
  switch (bowl.state) {
    case "selected": return `${bowl.selection!.bowl} vs ${bowl.selection!.opponent}, ${formatEventDate(bowl.selection!.date)}.`;
    case "eligible": return `Bowl eligible with ${count(bowl.countedWins)} counted wins.${fcsNote}`;
    case "unconfirmed": return `${capitalized(count(bowl.countedWins + bowl.unclassifiedWins))} wins, but ${bowl.unclassifiedWins === 1 ? "one opponent has" : `${count(bowl.unclassifiedWins)} opponents have`} not been confirmed to count toward eligibility.`;
    case "alive": {
      const left = `${count(bowl.gamesLeft)} ${bowl.gamesLeft === 1 ? "game" : "games"} left`;
      const limit = bowl.countableGamesLeft < bowl.gamesLeft ? `, and only ${count(bowl.countableGamesLeft)} can count` : "";
      return `${capitalized(count(bowl.winsNeeded))} more ${bowl.winsNeeded === 1 ? "win" : "wins"} to reach ${count(bowl.winsRequired)}, with ${left}${limit}.${fcsNote}`;
    }
    case "out": return bowl.alternateStillPossible
      ? `${capitalized(count(bowl.winsRequired))} wins are out of reach. A ${bowl.alternates.wins}-${bowl.alternates.losses} team can still be picked if bowls run short of eligible teams.`
      : `${capitalized(count(bowl.winsRequired))} wins are out of reach, and so is ${bowl.alternates.wins}-${bowl.alternates.losses}.`;
    default: return "This schedule runs longer than the standard bowl rule covers, so eligibility is not shown.";
  }
}

// The one figure the section leads with, and the sentence beside it.
export function leadFigure(outlook: TeamPostseason): { figure: string; unit?: string; context: string } {
  const { playoff, bowl, record } = outlook;
  if (outlook.lead === "playoff") {
    if (playoff.standing === "in-field") return { figure: `Seed ${playoff.seed!.seed}`, context: seedLine(playoff) };
    if (playoff.phase === "rankings" && playoff.committeeRank !== null) {
      return { figure: `No. ${playoff.committeeRank}`, context: playoffLine(playoff, record) };
    }
    const next = playoff.nextRanking ? ` The committee's ${playoff.nextRanking.label === "First rankings" ? "first rankings come" : "next rankings come"} out ${formatEventDate(playoff.nextRanking.date)}.` : "";
    return { figure: recordLabel(record), context: `${playoffLine(playoff, record)}${next}` };
  }
  switch (bowl.state) {
    case "alive": return { figure: String(bowl.winsNeeded), unit: bowl.winsNeeded === 1 ? "win to go" : "wins to go", context: bowlLine(bowl) };
    case "eligible": return { figure: "Eligible", context: bowlLine(bowl) };
    case "selected": return { figure: recordLabel(record), context: `Bowl bound: ${bowlLine(bowl)}` };
    default: return { figure: recordLabel(record), context: bowlLine(bowl) };
  }
}

export function rankingStatusLine(playoff: PlayoffOutlook): string | undefined {
  if (playoff.rankingBehind) {
    return `The ${formatEventDate(playoff.rankingBehind.date)} committee rankings have not been checked yet.`;
  }
  return undefined;
}
