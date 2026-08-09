import type { TeamConfig } from "@/config/team";
import type { ScheduleGame, ScheduleSite, TeamSchedule } from "@/server/schedule/schedule";

// The subset of CollegeFootballData's /games response this build depends on.
// Typed narrowly on purpose: a field we do not read is a field that cannot
// break the fixture when CFBD adds or renames one.
export type CfbdScheduleGame = {
  id: number;
  season: number;
  week: number;
  startDate?: string | null;
  startTimeTBD?: boolean | null;
  homeTeam: string;
  awayTeam: string;
  neutralSite?: boolean | null;
  venue?: string | null;
};

// From /games/media. One game can have several rows (TV plus radio plus web),
// so outlets are collected per game id.
export type CfbdMediaEntry = {
  id: number;
  mediaType?: string | null;
  outlet?: string | null;
};

export type BuildScheduleInput = {
  team: TeamConfig;
  games: readonly CfbdScheduleGame[];
  media?: readonly CfbdMediaEntry[];
  // The team's home zone, e.g. "America/Denver". Every fan-facing time is
  // rendered in it, including road games — a fan in Logan wants to know when
  // to turn the TV on, not what the clock says in Seattle.
  timeZone: string;
  sourceUrl: string;
  capturedAt: string;
};

// Turns a CFBD payload into the schedule fixture the app reads. Kept pure and
// separate from the fetch so it can be tested without a key or a network, and
// so a schedule can also be built from a saved payload.
export function buildTeamSchedule(input: BuildScheduleInput): TeamSchedule {
  const { team, games, media, timeZone, sourceUrl, capturedAt } = input;
  const outlets = collectOutlets(media);

  const teamGames = games
    .filter((game) => involvesTeam(game, cfbdTeamName(team)))
    .slice()
    .sort(byStartDate);

  return {
    teamSlug: team.slug,
    teamName: team.shortName,
    teamDisplayName: team.displayName,
    seasonYear: seasonOf(teamGames, team),
    sourceUrl,
    capturedAt,
    games: teamGames.map((game) => toScheduleGame(game, team, timeZone, outlets)),
  };
}

function toScheduleGame(
  game: CfbdScheduleGame,
  team: TeamConfig,
  timeZone: string,
  outlets: Map<number, string[]>,
): ScheduleGame {
  const opponent = opponentOf(game, cfbdTeamName(team));
  // CFBD publishes a placeholder kickoff for games whose window is not set and
  // flags them with startTimeTBD. Rendering that placeholder as a real time is
  // how a schedule quietly starts lying, so an unset window stays unset.
  const confirmed = Boolean(game.startDate) && game.startTimeTBD !== true;
  const kickoffDate = game.startDate ? new Date(game.startDate) : null;
  const usable = kickoffDate && !Number.isNaN(kickoffDate.getTime()) ? kickoffDate : null;

  return {
    id: buildGameId(game, team, opponent),
    opponent,
    site: siteOf(game, cfbdTeamName(team)),
    dateLabel: usable ? formatDateLabel(usable, timeZone) : "Date to be announced",
    startsAt: confirmed && usable ? usable.toISOString() : null,
    // Reads as a sentence downstream: the composer renders "Kickoff is
    // {kickoff}", so the placeholder has to be a noun phrase, not a label.
    kickoff: confirmed && usable ? formatKickoff(usable, timeZone) : "still to be announced",
    venue: game.venue?.trim() || "Venue to be announced",
    tv: outlets.get(game.id)?.join(" or ") ?? null,
  };
}

// "Saturday, September 5"
export function formatDateLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
}

// "2:30 p.m. MT" — the house style from the existing fixtures: no ":00" on the
// hour, lowercase meridiem with periods, and a generic zone label rather than
// MDT/MST, because a fan reads "MT" and does not care which side of a clock
// change the game falls on.
export function formatKickoff(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const hour = value("hour");
  const minute = value("minute");
  const meridiem = value("dayPeriod").toLowerCase().replace("am", "a.m.").replace("pm", "p.m.");
  const clock = minute === "00" ? hour : `${hour}:${minute}`;

  return `${clock} ${meridiem} ${genericZoneLabel(value("timeZoneName"))}`.trim();
}

// MDT and MST are the same thing to a fan planning a Saturday. Anything that
// is not a three-letter daylight/standard pair is passed through untouched, so
// offsets like "GMT+2" survive rather than being mangled.
function genericZoneLabel(zoneName: string): string {
  const match = /^([A-Z])[DS]T$/.exec(zoneName);

  return match ? `${match[1]}T` : zoneName;
}

function collectOutlets(media: readonly CfbdMediaEntry[] | undefined): Map<number, string[]> {
  const outlets = new Map<number, string[]>();

  for (const entry of media ?? []) {
    // Radio and web streams are not what "TV" means on a schedule row.
    if (entry.mediaType && entry.mediaType.toLowerCase() !== "tv") {
      continue;
    }

    const outlet = entry.outlet?.trim();

    if (!outlet) {
      continue;
    }

    const existing = outlets.get(entry.id) ?? [];

    if (!existing.includes(outlet)) {
      outlets.set(entry.id, [...existing, outlet]);
    }
  }

  return outlets;
}

// CFBD keys games by the name in its own team table, which is not always the
// display name a fan sees. `cfbd.team` is that key; falling back to shortName
// keeps the mapper usable for a team that has not been wired to CFBD yet.
function cfbdTeamName(team: TeamConfig): string {
  return team.cfbd?.team ?? team.shortName;
}

function involvesTeam(game: CfbdScheduleGame, teamName: string): boolean {
  return matches(game.homeTeam, teamName) || matches(game.awayTeam, teamName);
}

function opponentOf(game: CfbdScheduleGame, teamName: string): string {
  return matches(game.homeTeam, teamName) ? game.awayTeam : game.homeTeam;
}

function siteOf(game: CfbdScheduleGame, teamName: string): ScheduleSite {
  if (game.neutralSite) {
    return "neutral";
  }

  return matches(game.homeTeam, teamName) ? "home" : "away";
}

function matches(value: string | undefined, teamName: string): boolean {
  return (value ?? "").trim().toLowerCase() === teamName.trim().toLowerCase();
}

function byStartDate(left: CfbdScheduleGame, right: CfbdScheduleGame): number {
  if (left.startDate && right.startDate) {
    return left.startDate.localeCompare(right.startDate);
  }

  // Games without a date sort by week so a partially announced season still
  // comes out in playing order.
  return left.week - right.week;
}

function seasonOf(games: readonly CfbdScheduleGame[], team: TeamConfig): number {
  return games[0]?.season ?? team.cfbd?.season ?? new Date().getUTCFullYear();
}

function buildGameId(game: CfbdScheduleGame, team: TeamConfig, opponent: string): string {
  const season = game.season || team.cfbd?.season || "";

  return [season, slugify(team.shortName), slugify(opponent)].filter(Boolean).join("-");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
