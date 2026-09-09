import texasSchedule from "../../../data/fixtures/texas-football/schedule.json";
import utahStateSchedule from "../../../data/fixtures/utah-state-football/schedule.json";
import ohioStateSchedule from "../../../data/fixtures/ohio-state-football/schedule.json";
import lsuSchedule from "../../../data/fixtures/lsu-football/schedule.json";

export type ScheduleSite = "home" | "away" | "neutral";

export type ScheduleGame = {
  id: string;
  opponent: string;
  site: ScheduleSite;
  dateLabel: string;
  startsAt: string | null;
  date: string | null;
  status: "scheduled" | "in-progress" | "final" | "postponed" | "cancelled";
  kickoff: string;
  venue: string;
  tv: string | null;
};

export type TeamSchedule = {
  teamSlug: string;
  teamName: string;
  teamDisplayName: string;
  seasonYear: number;
  sourceUrl: string;
  capturedAt: string;
  timeZone: string;
  provenance?: {
    provider: "official" | "cfbd";
    sourceUrl: string;
    retrievedAt: string;
    officialVerifiedAt?: string;
  };
  games: ScheduleGame[];
};

// Keyed by the fixture's own teamSlug so a new edition is a file plus an
// import, never an edit to a hand-maintained key list that can disagree with
// the data it points at.
const schedules: Record<string, TeamSchedule> = Object.fromEntries(
  [texasSchedule, utahStateSchedule, ohioStateSchedule, lsuSchedule].map((schedule) => [
    schedule.teamSlug,
    schedule as unknown as TeamSchedule,
  ]),
);

export function getTeamSchedule(teamSlug: string): TeamSchedule | undefined {
  return schedules[teamSlug];
}

// Keep today's game available all day unless a provider confirms it is final.
// A missing kickoff is not a missing date, and cannot keep an old game upcoming.
export function getNextGame(teamSlug: string, now = new Date()): ScheduleGame | undefined {
  const schedule = getTeamSchedule(teamSlug);
  return schedule ? getUpcomingGames(schedule, now)[0] : undefined;
}

export function getUpcomingGames(schedule: TeamSchedule, now = new Date()): ScheduleGame[] {
  const today = calendarDate(now, schedule.timeZone);
  return schedule.games.filter((game) =>
    (game.status === "scheduled" || game.status === "in-progress") &&
    game.date !== null && game.date >= today,
  ).sort((a, b) => a.date!.localeCompare(b.date!));
}

export function calendarDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatSite(site: ScheduleSite): string {
  return site === "away" ? "at" : "vs";
}

export type KickoffCountdown =
  | { state: "scheduled"; days: number }
  | { state: "today" }
  | { state: "unscheduled" };

// Drives the lead figure on the dashboard. Counts whole calendar days in the
// venue's local reckoning rather than 24-hour blocks, because a fan asking
// "how long until the game" means sleeps, not hours — an 11 a.m. Saturday
// kickoff is still "tomorrow" when asked at 9 p.m. Friday.
//
// Returns a discriminated union rather than a bare number so the caller cannot
// render a countdown for a game that has no kickoff time yet. The lead figure
// must always be real; "TBD" is a real answer and 0 is not a substitute for it.
export function getKickoffCountdown(
  game: Pick<ScheduleGame, "startsAt"> | undefined,
  now = new Date(),
  timeZone = "UTC",
): KickoffCountdown {
  if (!game?.startsAt) {
    return { state: "unscheduled" };
  }

  const kickoff = new Date(game.startsAt);

  if (Number.isNaN(kickoff.getTime())) {
    return { state: "unscheduled" };
  }

  const days = Math.round((Date.parse(calendarDate(kickoff, timeZone)) - Date.parse(calendarDate(now, timeZone))) / dayInMs);

  if (days < 0) return { state: "unscheduled" };
  if (days === 0) {
    return { state: "today" };
  }

  return { state: "scheduled", days };
}

const dayInMs = 24 * 60 * 60 * 1000;

export function formatCaptureDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
