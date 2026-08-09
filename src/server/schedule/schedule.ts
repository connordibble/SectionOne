import texasSchedule from "../../../data/fixtures/texas-football/schedule.json";

export type ScheduleSite = "home" | "away" | "neutral";

export type ScheduleGame = {
  id: string;
  opponent: string;
  site: ScheduleSite;
  dateLabel: string;
  startsAt: string | null;
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
  games: ScheduleGame[];
};

const schedules: Record<string, TeamSchedule> = {
  "texas-football": texasSchedule as unknown as TeamSchedule,
};

export function getTeamSchedule(teamSlug: string): TeamSchedule | undefined {
  return schedules[teamSlug];
}

// Returns the first game that has not yet happened. A game counts as upcoming
// when its kickoff is in the future or its start time is still unscheduled
// (null), which keeps later-season TBD games ahead of already-played ones.
export function getNextGame(teamSlug: string, now = new Date()): ScheduleGame | undefined {
  const schedule = getTeamSchedule(teamSlug);

  if (!schedule || schedule.games.length === 0) {
    return undefined;
  }

  const upcoming = schedule.games.find(
    (game) => !game.startsAt || new Date(game.startsAt) >= now,
  );

  return upcoming ?? schedule.games[0];
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
): KickoffCountdown {
  if (!game?.startsAt) {
    return { state: "unscheduled" };
  }

  const kickoff = new Date(game.startsAt);

  if (Number.isNaN(kickoff.getTime())) {
    return { state: "unscheduled" };
  }

  const days = Math.ceil((startOfDay(kickoff) - startOfDay(now)) / dayInMs);

  if (days <= 0) {
    return { state: "today" };
  }

  return { state: "scheduled", days };
}

const dayInMs = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function formatCaptureDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
