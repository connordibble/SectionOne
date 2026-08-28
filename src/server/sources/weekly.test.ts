// @vitest-environment node
import { describe, expect, it } from "vitest";
import { enabledTeamSlugs } from "@/config/team";
import {
  describeSourceMix,
  maxItemsPerOutlet,
  minDistinctOutlets,
} from "./story-selection";
import {
  admitWeeklyEdition,
  getWeeklyEdition,
  getWeeklyNewsDocuments,
  maxNewsItems,
  type NewsItem,
  type WeeklyEdition,
} from "./weekly";

describe("weekly edition", () => {
  it("publishes a package for every live edition", () => {
    for (const slug of enabledTeamSlugs) {
      expect(getWeeklyEdition(slug), `${slug} has no weekly package`).toBeDefined();
    }
  });

  // A briefing that grows without limit is the feed this product exists to
  // replace, so the cap is enforced on read rather than trusted to the author.
  it("caps the briefing at five items", () => {
    for (const slug of enabledTeamSlugs) {
      expect(getWeeklyEdition(slug)!.items.length).toBeLessThanOrEqual(maxNewsItems);
    }
  });

  // The summary is ours; the reporting is not. An item a fan cannot go check
  // is an item asking to be taken on faith, which is the one thing this
  // product does not do.
  it("gives every item an outlet and a working-looking link", () => {
    for (const slug of enabledTeamSlugs) {
      for (const item of getWeeklyEdition(slug)!.items) {
        expect(item.outlet, `${slug}/${item.id} has no outlet`).not.toHaveLength(0);
        expect(item.url, `${slug}/${item.id} has no link`).toMatch(/^https:\/\//);
        expect(Number.isNaN(new Date(item.publishedAt).getTime())).toBe(false);
      }
    }
  });

  it("dates every item at or before the week it is published for", () => {
    for (const slug of enabledTeamSlugs) {
      const edition = getWeeklyEdition(slug)!;

      for (const item of edition.items) {
        expect(
          new Date(item.publishedAt).getTime(),
          `${slug}/${item.id} is dated after its own package`,
        ).toBeLessThanOrEqual(new Date(edition.publishedAt).getTime());
      }
    }
  });

  // The requirement, not a preference. Three items from one masthead is one
  // desk's read of the week presented as the week — which is what the first
  // Texas package was, three of five from the same national outlet.
  it("never lets one outlet own the list", () => {
    for (const slug of enabledTeamSlugs) {
      const mix = getWeeklyEdition(slug)!.sourceMix!;

      expect(mix.distinctOutlets, `${slug} draws on too few outlets`).toBeGreaterThanOrEqual(
        minDistinctOutlets,
      );
      expect(mix.maxFromOneOutlet, `${slug} leans on one outlet`).toBeLessThanOrEqual(
        maxItemsPerOutlet,
      );
    }
  });

  // Beat reporters are at practice and know the two-deep. National coverage is
  // welcome; a list it dominates is a list about the sport rather than about
  // this team.
  it("keeps local reporting ahead of national coverage", () => {
    for (const slug of enabledTeamSlugs) {
      const { byTier } = getWeeklyEdition(slug)!.sourceMix!;

      expect(byTier.local, `${slug} has no local reporting`).toBeGreaterThan(0);
      expect(byTier.national, `${slug} is led by national coverage`).toBeLessThanOrEqual(
        byTier.local,
      );
    }
  });

  it("ranks by the rubric rather than by the order someone typed the file", () => {
    for (const slug of enabledTeamSlugs) {
      const items = getWeeklyEdition(slug)!.items;
      const raw = describeSourceMix(items);

      expect(raw.distinctOutlets).toBeGreaterThan(1);
      // Selection is a sort, not a filter: nothing is silently dropped when
      // the package already fits in five.
      expect(items).toHaveLength(maxNewsItems);
    }
  });

  it("grades every item on all three factors", () => {
    for (const slug of enabledTeamSlugs) {
      for (const item of getWeeklyEdition(slug)!.items) {
        for (const factor of ["impact", "echo", "freshness"] as const) {
          const value = item.grade[factor];

          expect(value, `${slug}/${item.id} ${factor}`).toBeGreaterThanOrEqual(0);
          expect(value, `${slug}/${item.id} ${factor}`).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("makes each item retrievable under the outlet's own provider", () => {
    const documents = getWeeklyNewsDocuments("utah-state-football");

    expect(documents).toHaveLength(5);
    expect(documents.every((document) => document.provider === "press")).toBe(true);
    // Highest-graded story first, and the outlet travels with it.
    expect(documents[0].title).toMatch(/depth/i);
    expect(documents[0].body).toContain("Deseret News");
  });

  it("returns nothing for a team with no package rather than guessing", () => {
    expect(getWeeklyEdition("nope-football")).toBeUndefined();
    expect(getWeeklyNewsDocuments("nope-football")).toEqual([]);
  });
});

// The link is the basis on which a fan is asked to believe our summary, and it
// is rendered into an href. Weekly packages are committed fixtures today; the
// moment they come from a feed, `url` is the field an outsider influences.
describe("weekly ingest admits only linkable items", () => {
  function itemWith(url: string, id = "item"): NewsItem {
    return {
      id,
      headline: "Headline",
      tldr: "One sentence.",
      outlet: "Outlet",
      tier: "local",
      url,
      publishedAt: "2026-08-04T12:00:00.000Z",
      grade: { impact: 3, echo: 3, freshness: 3 },
    };
  }

  function editionWith(items: NewsItem[]): WeeklyEdition {
    return {
      teamSlug: "texas-football",
      weekOf: "2026-08-09",
      publishedAt: "2026-08-09T12:00:00.000Z",
      summary: "Summary.",
      items,
    };
  }

  it("drops an item whose link would execute script instead of opening a source", () => {
    const admitted = admitWeeklyEdition(
      editionWith([
        itemWith("https://example.com/story", "keep"),
        itemWith("javascript:alert(document.cookie)", "script"),
        itemWith("data:text/html,<script>alert(1)</script>", "data"),
      ]),
    );

    expect(admitted.items.map((item) => item.id)).toEqual(["keep"]);
  });

  it("keeps ordinary reporting links untouched", () => {
    const items = [
      itemWith("https://www.deseret.com/sports/story/", "a"),
      itemWith("http://example.com/b?ref=1#top", "b"),
    ];

    expect(admitWeeklyEdition(editionWith(items)).items).toHaveLength(2);
  });

  // The published fixtures have to pass the same gate they will be held to.
  it("publishes every shipped item with an http(s) link", () => {
    for (const slug of enabledTeamSlugs) {
      for (const item of getWeeklyEdition(slug)?.items ?? []) {
        expect(item.url, `${slug} ${item.id}`).toMatch(/^https?:\/\//);
      }
    }
  });
});
