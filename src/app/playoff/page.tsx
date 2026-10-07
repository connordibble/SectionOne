import type { Metadata } from "next";
import { connection } from "next/server";
import { enabledTeamSlugs, getTeamConfig } from "@/config/team";
import { Playoff } from "@/features/playoff/playoff";
import { getLatestPollWeek } from "@/server/facts/live-poll";
import { withPollSnapshot } from "@/server/facts/poll-snapshot";
import { getPlayoffTracker } from "@/server/postseason/postseason";
import { getTeamSchedule } from "@/server/schedule/schedule";
import { getTeamRankingSummary } from "@/server/sources/rankings";

const title = "The playoff race · Section One";
const description = "Where the College Football Playoff stands: the committee's top 25, how the 12 get in, every date, and each Section One team's path, with sources.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/playoff" },
  openGraph: { type: "website", siteName: "Section One", title, description, url: "/playoff", images: ["/opengraph-image.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image.png"] },
};

export default async function PlayoffPage() {
  await connection();
  const teams = enabledTeamSlugs.flatMap((slug) => getTeamConfig(slug) ?? []);
  const seasonYear = teams.map((team) => getTeamSchedule(team.slug)?.seasonYear).find((year) => year !== undefined);
  const poll = seasonYear ? await getLatestPollWeek(seasonYear) : undefined;
  const ranks = new Map(teams.map((team) => [team.slug, withPollSnapshot(poll, () => getTeamRankingSummary(team))?.teamRank]));
  const tracker = await getPlayoffTracker(teams, (team) => ranks.get(team.slug), new Date());
  return <Playoff tracker={tracker} />;
}
