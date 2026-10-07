import type { CommitteeRanking } from "./committee";
import type { PostseasonSeason } from "./season";

export type PlayoffMilestone = { date: string; label: string };

// The next thing worth counting down to. Every game day counts: a round spread
// over two days is still on during its second, and the clock must not jump
// past games being played. Releases already verified are behind us, and once
// the field is set there are no more rankings to wait for.
export function nextPlayoffMilestone(season: PostseasonSeason, today: string, committee?: CommitteeRanking): PlayoffMilestone | undefined {
  const releases = season.playoff.rankings.filter((release) => !committee || release.date > committee.releasedAt);
  const games = season.playoff.rounds.flatMap((round) => round.dates.map((date) => ({ date, label: round.name })));
  return [...(season.confirmed.playoffField ? [] : releases), ...games]
    .filter((milestone) => milestone.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

export type TimelineState = "past" | "now" | "next" | "later";
export type TimelineEntry = {
  id: string;
  dates: string[];
  label: string;
  detail: string;
  kind: "ranking" | "selection" | "games";
  state: TimelineState;
};

// The season's postseason calendar as one ordered list. "now" is a date range
// that includes today; "next" is the first entry still ahead.
export function postseasonTimeline(season: PostseasonSeason, today: string): TimelineEntry[] {
  const entries = [
    ...season.playoff.rankings.map((release) => ({
      id: `ranking-${release.date}`, dates: [release.date], label: release.label,
      detail: release.date === season.playoff.selectionDay ? "Final ranking and the field" : "Committee top 25",
      kind: release.date === season.playoff.selectionDay ? "selection" as const : "ranking" as const,
    })),
    ...season.playoff.rounds.map((round) => ({
      id: `round-${round.dates[0]}`, dates: round.dates, label: round.name, detail: round.sites.join(", "), kind: "games" as const,
    })),
  ].sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
  let nextAssigned = false;
  return entries.map((entry) => {
    const first = entry.dates[0], last = entry.dates.at(-1)!;
    let state: TimelineState = "later";
    if (last < today) state = "past";
    else if (first <= today) state = "now";
    else if (!nextAssigned) state = "next";
    if (state === "now" || state === "next") nextAssigned = true;
    return { ...entry, state };
  });
}
