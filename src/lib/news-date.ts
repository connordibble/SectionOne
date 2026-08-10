/**
 * Formats a source's publication date for display: "Aug 4".
 *
 * This lives in `lib` rather than beside the weekly package it describes
 * because the Brief renders it from a client component. Importing it from
 * `server/sources/weekly` pulled that whole module — fixture JSON, the story
 * grader, and through the failure reporter, `next/server` — into the browser
 * bundle. A pure formatter has no reason to drag a server module behind it.
 *
 * UTC is deliberate. These are publication dates, not kickoff times: rendering
 * one in the reader's zone can move a story to the previous day for anyone west
 * of the outlet, which makes a freshness label say the wrong thing.
 */
export function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
