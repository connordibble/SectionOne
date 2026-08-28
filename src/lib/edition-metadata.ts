import type { Metadata } from "next";
import type { TeamConfig } from "@/config/team";
import { formatSite, type ScheduleGame } from "@/server/schedule/schedule";

export function buildEditionMetadata(
  team: TeamConfig,
  nextGame: ScheduleGame | undefined,
): Metadata {
  const matchup = nextGame
    ? `${team.shortName} ${formatSite(nextGame.site)} ${nextGame.opponent}`
    : team.displayName;
  const title = `${matchup} · Section One`;
  const description = nextGame
    ? `${team.editorial.lead.headline} What to watch before ${matchup}, with sources.`
    : `${team.tagline} A short, sourced briefing for ${team.displayName}.`;
  const pathname = `/teams/${team.slug}`;
  const image = `/social/${team.slug}.png`;
  const imageAlt = `${matchup}. ${team.editorial.lead.headline} Section One.`;

  return {
    title,
    description,
    alternates: { canonical: pathname },
    openGraph: {
      type: "website",
      siteName: "Section One",
      title,
      description,
      url: pathname,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
  };
}
