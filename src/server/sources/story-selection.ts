import type { NewsItem, OutletTier } from "./weekly";

// How a story earns its slot. Three graded inputs, one age decay, one
// preference. See docs/story-selection.md for the anchors each grade is
// assigned against — the numbers here are the weighting, not the judgement.
export const storyWeights = {
  // What it changes about what to expect on Saturday. Weighted highest on
  // purpose: a big story carried by one outlet still outranks a small one
  // everybody repeated.
  impact: 0.45,
  // How many independent outlets and timelines are on the same theme. This is
  // the closest thing to a measurement in the rubric — it is a count, not a
  // feeling — and it is what stops one outlet's pet angle leading the list.
  echo: 0.3,
  // How much run it is getting right now, as distinct from when it broke. A
  // story from Monday still being written about Friday is live; one that
  // landed and died is not.
  freshness: 0.25,
} as const;

// Local beat reporters watch practice, know the two-deep, and are usually
// first and most specific. National coverage is welcome and often better on
// context, but a list it dominates is a list about the sport rather than
// about this team. The nudge is deliberately small: it breaks near-ties and
// does not let a thin local piece outrank a real national one.
export const localBonus = 0.35;

// Half-life in days. A week is the natural unit of a football news cycle, so
// last Saturday's story is worth half of this one at the same grade, and it
// falls off the list on its own rather than waiting to be pruned.
export const freshnessHalfLifeDays = 7;

// No outlet holds more than two of five. Not a style preference: three items
// from one masthead is one desk's read of the week presented as the week.
export const maxItemsPerOutlet = 2;
export const minDistinctOutlets = 3;

export type ScoredNewsItem = NewsItem & { score: number };

export function scoreNewsItem(item: NewsItem, asOf: Date): number {
  const { impact, echo, freshness } = item.grade;
  const base =
    impact * storyWeights.impact +
    echo * storyWeights.echo +
    freshness * storyWeights.freshness +
    (item.tier === "local" ? localBonus : 0);

  return round(base * decay(item.publishedAt, asOf));
}

// Ranks by score, then fills the list under a per-outlet cap.
//
// The cap is applied during selection rather than after, because filtering a
// finished list just leaves holes. If the cap cannot be met — a quiet week
// where only one or two outlets published — the remaining slots are filled
// anyway and `relaxed` says so. A short list is not more honest than an
// unbalanced one; both are worse than knowing which you are looking at.
export function selectTopStories(
  items: readonly NewsItem[],
  options: { limit: number; asOf: Date; maxPerOutlet?: number },
): { stories: ScoredNewsItem[]; relaxed: boolean } {
  const cap = options.maxPerOutlet ?? maxItemsPerOutlet;
  const ranked = items
    .map((item) => ({ ...item, score: scoreNewsItem(item, options.asOf) }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const perOutlet = new Map<string, number>();
  const stories: ScoredNewsItem[] = [];
  const held: ScoredNewsItem[] = [];

  for (const story of ranked) {
    if (stories.length >= options.limit) {
      break;
    }

    const outlet = story.outlet.toLowerCase();
    const used = perOutlet.get(outlet) ?? 0;

    if (used >= cap) {
      held.push(story);
      continue;
    }

    perOutlet.set(outlet, used + 1);
    stories.push(story);
  }

  const shortfall = options.limit - stories.length;
  const filled = shortfall > 0 ? held.slice(0, shortfall) : [];

  return {
    stories: [...stories, ...filled].sort((left, right) => right.score - left.score),
    relaxed: filled.length > 0,
  };
}

export type SourceMix = {
  distinctOutlets: number;
  maxFromOneOutlet: number;
  byTier: Record<OutletTier, number>;
};

export function describeSourceMix(items: readonly NewsItem[]): SourceMix {
  const counts = new Map<string, number>();
  const byTier: Record<OutletTier, number> = { local: 0, national: 0, official: 0 };

  for (const item of items) {
    const outlet = item.outlet.toLowerCase();
    counts.set(outlet, (counts.get(outlet) ?? 0) + 1);
    byTier[item.tier] += 1;
  }

  return {
    distinctOutlets: counts.size,
    maxFromOneOutlet: Math.max(0, ...counts.values()),
    byTier,
  };
}

function decay(publishedAt: string, asOf: Date): number {
  const ageMs = asOf.getTime() - new Date(publishedAt).getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);

  return 0.5 ** (ageDays / freshnessHalfLifeDays);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
