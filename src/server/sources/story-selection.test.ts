// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeSourceMix, scoreNewsItem, selectTopStories } from "./story-selection";
import type { NewsItem, OutletTier } from "./weekly";

const asOf = new Date("2026-08-09T15:00:00.000Z");

function item(
  id: string,
  outlet: string,
  tier: OutletTier,
  grade: { impact: number; echo: number; freshness: number },
  publishedAt = "2026-08-09T00:00:00.000Z",
): NewsItem {
  return {
    id,
    headline: id,
    tldr: `${id} takeaway`,
    outlet,
    tier,
    url: `https://example.com/${id}`,
    publishedAt,
    grade,
  };
}

describe("scoreNewsItem", () => {
  it("weights impact above the other two factors", () => {
    const big = item("big", "A", "national", { impact: 5, echo: 0, freshness: 0 });
    const loud = item("loud", "A", "national", { impact: 0, echo: 5, freshness: 5 });

    // A story that matters carried by one outlet beats a small one everyone
    // repeated — but not by so much that echo and freshness stop counting.
    expect(scoreNewsItem(big, asOf)).toBeLessThan(scoreNewsItem(loud, asOf));
    expect(scoreNewsItem(big, asOf)).toBeGreaterThan(
      scoreNewsItem(item("mid", "A", "national", { impact: 0, echo: 5, freshness: 0 }), asOf),
    );
  });

  it("decays a story as the news cycle moves past it", () => {
    const grade = { impact: 4, echo: 4, freshness: 4 };
    const today = scoreNewsItem(
      item("t", "A", "national", grade, asOf.toISOString()),
      asOf,
    );
    const lastWeek = scoreNewsItem(
      item("w", "A", "national", grade, "2026-08-02T15:00:00.000Z"),
      asOf,
    );

    // One half-life back, so roughly half the score.
    expect(lastWeek).toBeCloseTo(today / 2, 2);
  });

  it("prefers the beat over national coverage at equal grades", () => {
    const grade = { impact: 3, echo: 3, freshness: 3 };

    expect(scoreNewsItem(item("l", "Local", "local", grade), asOf)).toBeGreaterThan(
      scoreNewsItem(item("n", "National", "national", grade), asOf),
    );
  });

  // The nudge breaks ties; it does not rewrite the rubric.
  it("does not let a thin local story outrank a real national one", () => {
    const thin = item("thin", "Local", "local", { impact: 1, echo: 1, freshness: 1 });
    const real = item("real", "National", "national", { impact: 5, echo: 4, freshness: 4 });

    expect(scoreNewsItem(thin, asOf)).toBeLessThan(scoreNewsItem(real, asOf));
  });
});

describe("selectTopStories", () => {
  it("caps how much of the list one outlet can hold", () => {
    const items = [
      item("a1", "Big Outlet", "national", { impact: 5, echo: 5, freshness: 5 }),
      item("a2", "Big Outlet", "national", { impact: 5, echo: 5, freshness: 4 }),
      item("a3", "Big Outlet", "national", { impact: 5, echo: 4, freshness: 4 }),
      item("b1", "Beat Writer", "local", { impact: 2, echo: 2, freshness: 2 }),
      item("c1", "Other Paper", "local", { impact: 1, echo: 1, freshness: 1 }),
    ];

    // Four slots against three outlets: the cap is satisfiable, so it holds.
    const { stories, relaxed } = selectTopStories(items, { limit: 4, asOf });
    const mix = describeSourceMix(stories);

    expect(relaxed).toBe(false);
    expect(mix.maxFromOneOutlet).toBe(2);
    // The third piece from the dominant outlet is displaced even though it
    // scores higher than both of the outlets that replaced it.
    expect(stories.map((story) => story.id)).not.toContain("a3");
    expect(mix.distinctOutlets).toBe(3);
  });

  // A quiet week is a real thing. Filling the list and saying so beats
  // silently shipping three items, and beats silently shipping five from one
  // masthead without flagging it.
  it("fills the list and reports when the cap could not be met", () => {
    const items = [
      item("a1", "Only Outlet", "local", { impact: 5, echo: 5, freshness: 5 }),
      item("a2", "Only Outlet", "local", { impact: 4, echo: 4, freshness: 4 }),
      item("a3", "Only Outlet", "local", { impact: 3, echo: 3, freshness: 3 }),
    ];

    const { stories, relaxed } = selectTopStories(items, { limit: 3, asOf });

    expect(stories).toHaveLength(3);
    expect(relaxed).toBe(true);
  });

  it("returns the list in scored order", () => {
    const items = [
      item("low", "A", "national", { impact: 1, echo: 1, freshness: 1 }),
      item("high", "B", "national", { impact: 5, echo: 5, freshness: 5 }),
      item("mid", "C", "national", { impact: 3, echo: 3, freshness: 3 }),
    ];

    expect(selectTopStories(items, { limit: 3, asOf }).stories.map((story) => story.id)).toEqual([
      "high",
      "mid",
      "low",
    ]);
  });

  it("is stable when two stories score identically", () => {
    const grade = { impact: 3, echo: 3, freshness: 3 };
    const items = [item("zebra", "A", "local", grade), item("alpha", "B", "local", grade)];

    expect(selectTopStories(items, { limit: 2, asOf }).stories.map((story) => story.id)).toEqual([
      "alpha",
      "zebra",
    ]);
  });
});
