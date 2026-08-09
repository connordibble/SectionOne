import texasWeekly from "../../../data/fixtures/texas-football/weekly-2026-08-09.json";
import utahStateWeekly from "../../../data/fixtures/utah-state-football/weekly-2026-08-09.json";
import { createSourceDocumentId } from "./ids";
import { describeSourceMix, selectTopStories, type SourceMix } from "./story-selection";
import type { SourceDocument } from "./types";

// Who published it, and how close they are to the team.
//
// "local" means someone who covers this program as their beat — they are at
// practice, they know the two-deep, and they are usually first and most
// specific. "national" is real coverage that happens to be about everyone.
// "official" is the athletic department, which is accurate about facts and is
// nobody's independent judgement.
export type OutletTier = "local" | "national" | "official";

// The rubric a story is graded against before it competes for a slot. Each
// runs 0-5; docs/story-selection.md holds the anchors so two people grading
// the same week land in the same place.
export type NewsGrade = {
  // What it changes about what to expect on Saturday.
  impact: number;
  // How many independent outlets and timelines are on the same theme.
  echo: number;
  // How much run it is getting now, as distinct from when it broke.
  freshness: number;
};

// One item a fan can read in about ten seconds: what happened, and the one
// sentence that says why it matters for Saturday. The link is not decoration —
// it is the whole basis on which a fan is being asked to believe the summary,
// so an item without an outlet and a URL is not publishable.
export type NewsItem = {
  id: string;
  headline: string;
  tldr: string;
  outlet: string;
  tier: OutletTier;
  url: string;
  publishedAt: string;
  grade: NewsGrade;
};

// The unit of editorial freshness. Team identity, voice, and page structure
// live in TeamConfig and change rarely; this changes every week, is versioned
// by `weekOf`, and is the only thing a weekly refresh has to produce.
export type WeeklyEdition = {
  teamSlug: string;
  weekOf: string;
  publishedAt: string;
  summary: string;
  items: NewsItem[];
  // Present on a package that has been through selection. Carried so the
  // diversity requirement can be asserted against what actually shipped
  // rather than against what was written down.
  sourceMix?: SourceMix;
};

// Five is the ceiling the section is designed around. A list longer than that
// stops being a briefing and becomes the feed this product exists to replace.
export const maxNewsItems = 5;

const editions: Record<string, WeeklyEdition> = Object.fromEntries(
  [texasWeekly, utahStateWeekly].map((edition) => [edition.teamSlug, edition as WeeklyEdition]),
);

// Returns the currently published package with its running top five already
// chosen. Ordering is not the order someone typed the file in: items are
// graded, decayed by age, and filled under a per-outlet cap, so the list
// re-ranks itself as the week moves without anyone re-sorting it by hand.
//
// When several weeks exist this becomes "the newest package at or before
// `now`" — the shape is already versioned by `weekOf` so that change does not
// reach callers.
export function getWeeklyEdition(teamSlug: string): WeeklyEdition | undefined {
  const edition = editions[teamSlug];

  if (!edition) {
    return undefined;
  }

  // Grade against the package's own publication date rather than the clock.
  // A package is a snapshot of one week's judgement; re-ranking it every time
  // the page is opened would silently rewrite what was published.
  const asOf = new Date(edition.publishedAt);
  const selection = selectTopStories(edition.items, { limit: maxNewsItems, asOf });

  return { ...edition, items: selection.stories, sourceMix: describeSourceMix(selection.stories) };
}

// Each item becomes its own retrievable document so chat can answer "what
// happened this week" from the same package the page renders, and cite the
// outlet rather than us.
export function getWeeklyNewsDocuments(teamSlug: string): SourceDocument[] {
  const edition = getWeeklyEdition(teamSlug);

  if (!edition) {
    return [];
  }

  return edition.items.map((item) => ({
    id: createSourceDocumentId([teamSlug, "news", edition.weekOf, item.id]),
    teamSlug,
    provider: "press",
    sourceType: "news",
    sourceUrl: item.url,
    title: item.headline,
    body: `${item.tldr} Reported by ${item.outlet} on ${formatNewsDate(item.publishedAt)}. Week of ${edition.weekOf}.`,
    metadata: {
      newsId: item.id,
      outlet: item.outlet,
      weekOf: edition.weekOf,
    },
    publishedAt: item.publishedAt,
    fetchedAt: edition.publishedAt,
  }));
}

export function formatNewsDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
