import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { enabledTeamSlugs, getTeamConfig } from "@/config/team";
import { TeamDashboard } from "@/features/team-dashboard/team-dashboard";
import { buildEditionMetadata } from "@/lib/edition-metadata";
import { getNextGame } from "@/server/schedule/schedule";

type TeamPageProps = {
  params: Promise<{ teamSlug: string }>;
};

export function generateStaticParams() {
  return enabledTeamSlugs.map((teamSlug) => ({ teamSlug }));
}

export async function generateMetadata({ params }: TeamPageProps): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = getTeamConfig(teamSlug);

  if (!team) {
    notFound();
  }

  return buildEditionMetadata(team, getNextGame(team.slug));
}

export default async function TeamPage({ params }: TeamPageProps) {
  await connection();

  const { teamSlug } = await params;
  const team = getTeamConfig(teamSlug);

  if (!team) {
    notFound();
  }

  return <TeamDashboard team={team} />;
}
