// Publication age is a reader cue, not a claim that every fact stays accurate
// for this interval. Polls and schedules carry their own observation dates.
export function editionNeedsReview(publishedAt: string, now: number): boolean {
  const published = Date.parse(publishedAt);
  return !Number.isFinite(published) || published > now || now - published >= 48 * 3_600_000;
}
