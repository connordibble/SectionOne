import { describe, expect, it } from "vitest";
import { teamManifests } from "./current";
import { findRequestedTeam } from "./request-match";

const teams = Object.values(teamManifests).map(({ identity }) => identity);

describe("findRequestedTeam", () => {
  it("resolves every configured name, route slug, and unambiguous alias", () => {
    for (const team of teams) {
      for (const name of [team.shortName, team.displayName, team.slug, ...team.aliases]) {
        const owners = teams.filter((candidate) =>
          [candidate.shortName, candidate.displayName, candidate.slug, ...candidate.aliases].includes(name),
        );
        if (owners.length === 1) expect(findRequestedTeam(name, teams)?.slug).toBe(team.slug);
      }
    }
  });

  it("accepts case, spacing, punctuation, and school-name variants", () => {
    expect(findRequestedTeam("  THE University of TEXAS!  ", teams)?.slug).toBe("texas-football");
    expect(findRequestedTeam("ohio-st.", teams)?.slug).toBe("ohio-state-football");
    expect(findRequestedTeam("Louisiana State University", teams)?.slug).toBe("lsu-football");
  });

  it.each(["", "University", "Texas State", "Kansas State", "Ohio", "Northwestern State", "App State"])(
    "does not guess a destination for %s", (name) => {
      expect(findRequestedTeam(name, teams)).toBeUndefined();
    },
  );

  it("does not choose between editions sharing an alias", () => {
    expect(findRequestedTeam("Tigers", [...teams, { ...teams[0], slug: "other-football", aliases: ["Tigers"] }])).toBeUndefined();
  });
});
