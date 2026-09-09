import { z } from "zod";

const date = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);
export const pollSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), releasedAt: date,
  sourceUrl: z.url().refine((url) => url.startsWith("https://")),
  ranks: z.array(z.object({ rank: z.number().int().min(1).max(25), team: z.string().trim().min(1) })).min(25).max(30),
}).superRefine((poll, ctx) => {
  const names = poll.ranks.map((row) => row.team.toLowerCase());
  if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Duplicate ranked team" });
  let previous = 0;
  poll.ranks.forEach((row, index) => {
    if (row.rank !== index + 1 && row.rank !== previous) ctx.addIssue({ code: "custom", message: "Incomplete or unordered ranking" });
    previous = row.rank;
  });
});
export const pollWeekSchema = z.object({
  season: z.number().int().min(2000).max(2200), week: z.number().int().min(0).max(30),
  weekLabel: z.string().min(1), capturedAt: z.iso.datetime({ offset: true }),
  polls: z.array(pollSchema).min(1),
  pending: z.array(z.object({ id: z.string(), name: z.string(), expectedAt: date, expectedLabel: z.string() })),
  provenance: z.object({
    provider: z.literal("espn"), sourceUrl: z.url(), retrievedAt: z.iso.datetime({ offset: true }),
    verifiedUrl: z.url(), throughDate: z.iso.date(),
  }).optional(),
});
export type PollWeek = z.infer<typeof pollWeekSchema>;
export type Poll = z.infer<typeof pollSchema>;
export type PollEntry = Poll["ranks"][number];
export type PendingPoll = PollWeek["pending"][number];

// Retrieval time alone cannot make an older publication current. Use the same
// ordering for bundled files and runtime refreshes, including season rollover.
export function comparePollSnapshots(a: PollWeek, b: PollWeek): number {
  if (a.season !== b.season) return a.season - b.season;
  if (a.week !== b.week) return a.week - b.week;
  const release = Date.parse(a.polls[0].releasedAt) - Date.parse(b.polls[0].releasedAt);
  return release || Date.parse(a.capturedAt) - Date.parse(b.capturedAt);
}

export function validatePollCutoff(poll: PollWeek, now: Date): void {
  const captured = Date.parse(poll.capturedAt);
  if (captured > now.getTime() || poll.polls.some((entry) => Date.parse(entry.releasedAt) > captured)) {
    throw new Error("Invalid poll cutoff");
  }
}
