import Link from "next/link";
import { enabledTeamSlugs, getTeamConfig } from "@/config/team";

// A 404 here is usually a fan guessing at a team route we have not published
// yet, so the useful response is the list of editions that do exist plus the
// request form — not an apology.
export default function NotFound() {
  const editions = enabledTeamSlugs.flatMap((slug) => {
    const team = getTeamConfig(slug);

    return team ? [team] : [];
  });

  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "38rem", margin: "0 auto", lineHeight: 1.6 }}>
      <h1>No edition here yet</h1>
      <p>That page does not exist. These do:</p>
      <ul>
        {editions.map((team) => (
          <li key={team.slug}>
            <Link href={`/teams/${team.slug}`}>{team.displayName}</Link>
          </li>
        ))}
      </ul>
      <p>
        Looking for a team we do not cover? <Link href="/#request">Ask for it</Link> — the teams
        fans ask for most are the ones covered next.
      </p>
    </main>
  );
}
