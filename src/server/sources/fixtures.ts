import { createSourceDocumentId } from "./ids";
import {
  formatCaptureDate,
  formatSite,
  getTeamSchedule,
  type ScheduleGame,
  type TeamSchedule,
} from "@/server/schedule/schedule";
import type { SourceDocument } from "./types";

export function getFixtureScheduleDocuments(teamSlug: string): SourceDocument[] {
  const schedule = getTeamSchedule(teamSlug);

  if (!schedule) {
    return [];
  }

  const fetchedAt = schedule.capturedAt;
  const summary = createScheduleSummaryDocument(schedule, fetchedAt);
  const games = schedule.games.map((game) =>
    createGameDocument(schedule, game, fetchedAt),
  );

  return [summary, ...games];
}

function createScheduleSummaryDocument(
  schedule: TeamSchedule,
  fetchedAt: string,
): SourceDocument {
  const opener = schedule.games[0];
  const captured = formatCaptureDate(schedule.capturedAt);

  return {
    id: createSourceDocumentId([schedule.teamSlug, String(schedule.seasonYear), "schedule"]),
    teamSlug: schedule.teamSlug,
    provider: "fixture",
    sourceType: "schedule",
    sourceUrl: schedule.sourceUrl,
    title: `${schedule.teamDisplayName} ${schedule.seasonYear} schedule`,
    body: `${schedule.teamDisplayName} has ${schedule.games.length} regular-season games on the published ${schedule.seasonYear} schedule. The opener is ${formatSite(opener.site)} ${opener.opponent} on ${opener.dateLabel} at ${opener.venue}. Source freshness: checked against the official schedule on ${captured}.`,
    metadata: {
      seasonYear: schedule.seasonYear,
      gameCount: schedule.games.length,
    },
    fetchedAt,
  };
}

function createGameDocument(
  schedule: TeamSchedule,
  game: ScheduleGame,
  fetchedAt: string,
): SourceDocument {
  const tv = game.tv ? ` TV: ${game.tv}.` : " TV assignment is not confirmed on the schedule.";
  const captured = formatCaptureDate(schedule.capturedAt);

  return {
    id: createSourceDocumentId([schedule.teamSlug, game.id]),
    teamSlug: schedule.teamSlug,
    provider: "fixture",
    sourceType: "game",
    sourceUrl: schedule.sourceUrl,
    title: `${schedule.teamName} ${formatSite(game.site)} ${game.opponent}`,
    body: `${schedule.teamName} ${formatSite(game.site)} ${game.opponent} on ${game.dateLabel}. Kickoff: ${game.kickoff}. Venue: ${game.venue}.${tv} Source freshness: schedule checked ${captured}.`,
    metadata: {
      seasonYear: schedule.seasonYear,
      gameId: game.id,
      opponent: game.opponent,
      site: game.site,
      startsAt: game.startsAt,
      kickoff: game.kickoff,
      venue: game.venue,
      tv: game.tv,
    },
    publishedAt: game.startsAt ?? undefined,
    fetchedAt,
  };
}
