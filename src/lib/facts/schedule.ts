import { z } from "zod";

const timeZoneSchema = z.string().refine((zone) => {
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return true; }
  catch { return false; }
}, "Invalid IANA timezone");
const sourceUrlSchema = z.url().refine((value) => {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
}, "Expected an HTTPS source URL without credentials");

export const scheduleGameSchema = z.object({
  id: z.string().min(1), opponent: z.string().min(1), site: z.enum(["home", "away", "neutral"]),
  dateLabel: z.string().min(1), startsAt: z.iso.datetime({ offset: true }).nullable(),
  date: z.iso.date().nullable(), status: z.enum(["scheduled", "in-progress", "final", "postponed", "cancelled"]),
  kickoff: z.string().min(1), venue: z.string().min(1), tv: z.string().min(1).nullable(),
});
export const teamScheduleSchema = z.object({
  teamSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), teamName: z.string().min(1), teamDisplayName: z.string().min(1),
  seasonYear: z.number().int().min(2000).max(2200), sourceUrl: sourceUrlSchema,
  capturedAt: z.iso.datetime({ offset: true }), timeZone: timeZoneSchema,
  provenance: z.object({ provider: z.enum(["official", "cfbd"]), sourceUrl: sourceUrlSchema,
    retrievedAt: z.iso.datetime({ offset: true }), officialVerifiedAt: z.iso.datetime({ offset: true }).optional() }).optional(),
  games: z.array(scheduleGameSchema),
}).superRefine((schedule, ctx) => {
  const ids = new Set<string>();
  const validZone = timeZoneSchema.safeParse(schedule.timeZone).success;
  schedule.games.forEach((game, index) => {
    if (ids.has(game.id)) ctx.addIssue({ code: "custom", path: ["games", index, "id"], message: "Duplicate game ID" });
    ids.add(game.id);
    if (game.startsAt && Number.isFinite(Date.parse(game.startsAt)) && validZone && game.date !== calendarDate(new Date(game.startsAt), schedule.timeZone)) {
      ctx.addIssue({ code: "custom", path: ["games", index, "date"], message: "Game date does not match kickoff in the team timezone" });
    }
  });
  if (schedule.provenance) {
    for (const key of ["retrievedAt", "officialVerifiedAt"] as const) {
      const value = schedule.provenance[key];
      if (value && Date.parse(value) > Date.parse(schedule.capturedAt)) ctx.addIssue({ code: "custom", path: ["provenance", key], message: "Verification is later than the snapshot" });
    }
  }
});

export type TeamSchedule = z.infer<typeof teamScheduleSchema>;
export type ScheduleGame = z.infer<typeof scheduleGameSchema>;
export type ScheduleSite = ScheduleGame["site"];

export function calendarDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
