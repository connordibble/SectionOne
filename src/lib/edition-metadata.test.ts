import { describe, expect, it } from "vitest";
import { enabledTeamSlugs, getTeamConfig } from "@/config/team";
import { getNextGame } from "@/server/schedule/schedule";
import { buildEditionMetadata } from "./edition-metadata";

describe("buildEditionMetadata", () => {
  it("gives every edition its own canonical, title, and social card", () => {
    const seenTitles = new Set<string>();
    const seenImages = new Set<string>();

    for (const slug of enabledTeamSlugs) {
      const team = getTeamConfig(slug)!;
      const metadata = buildEditionMetadata(team, getNextGame(slug));
      const expectedPath = `/teams/${slug}`;
      const title = String(metadata.title);
      const openGraphImages = metadata.openGraph?.images;
      const image = Array.isArray(openGraphImages) ? openGraphImages[0] : openGraphImages;
      const twitterImages = metadata.twitter?.images;
      const twitterImage = Array.isArray(twitterImages) ? twitterImages[0] : twitterImages;
      const imageUrl = typeof image === "string" || image instanceof URL ? String(image) : image?.url;

      expect(metadata.alternates?.canonical).toBe(expectedPath);
      expect(metadata.openGraph?.url).toBe(expectedPath);
      expect(title).toContain(team.shortName);
      expect(metadata.description).toContain("with sources");
      expect(imageUrl).toBe(`/social/${slug}.png`);
      expect(twitterImage).toMatchObject({
        url: `/social/${slug}.png`,
        width: 1200,
        height: 630,
      });

      seenTitles.add(title);
      seenImages.add(String(imageUrl));
    }

    expect(seenTitles.size).toBe(enabledTeamSlugs.length);
    expect(seenImages.size).toBe(enabledTeamSlugs.length);
  });
});
