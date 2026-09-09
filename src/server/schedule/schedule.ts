import { teamManifests } from "@/lib/teams/current";
import { calendarDate, type ScheduleGame, type ScheduleSite, type TeamSchedule } from "@/lib/facts/schedule";
export { calendarDate, type ScheduleGame, type ScheduleSite, type TeamSchedule } from "@/lib/facts/schedule";

export function getTeamSchedule(teamSlug: string): TeamSchedule | undefined {
  return teamManifests[teamSlug as keyof typeof teamManifests]?.schedule;
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

export function formatSite(site: ScheduleSite): string {
  return site === "away" ? "at" : "vs";
}

export type KickoffCountdown =
  | { state: "scheduled"; days: number }
  | { state: "today" }
  | { state: "unscheduled" };

// Drives the lead figure on the dashboard. Counts whole calendar days in the
// team's local reckoning rather than 24-hour blocks, because a fan asking
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
