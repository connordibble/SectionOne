import type { MetadataRoute } from "next";
import { enabledTeamSlugs } from "@/config/team";
import { getWeeklyEdition } from "@/server/sources/weekly";
import { siteUrl } from "./layout";

export const dynamic = "force-static";

// Built from the same config the router uses, so a new edition appears here
// the moment it is enabled rather than when someone remembers to add it.
export default function sitemap(): MetadataRoute.Sitemap {
  const editions = enabledTeamSlugs.map((slug) => ({
    url: new URL(`/teams/${slug}`, siteUrl).toString(),
    // An edition changes when its weekly package does. Claiming daily updates
    // on a page that changes weekly just teaches crawlers to ignore the hint.
    lastModified: new Date(getWeeklyEdition(slug)?.publishedAt ?? Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: siteUrl.toString(),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...editions,
  ];
}
