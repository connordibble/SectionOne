"use client";

import { useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { normalizeTeamName } from "@/lib/teams/request-match";
import styles from "./home.module.css";

type DirectoryTeam = {
  slug: string;
  shortName: string;
  conference: string;
  aliases: string[];
};

export function EditionDirectory({ teams }: { teams: DirectoryTeam[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const term = normalizeTeamName(query);
  const matches = teams.filter((team) =>
    [team.shortName, team.conference, ...team.aliases].some((name) =>
      normalizeTeamName(name).includes(term),
    ),
  );
  const conferences = [...new Set(matches.map((team) => team.conference))].sort();

  return (
    <div className={styles.directory} data-testid="edition-directory">
      <div className={styles.requestField}>
        <label htmlFor="edition-search">Find your team</label>
        <input
          aria-describedby="edition-search-help"
          autoComplete="off"
          id="edition-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          ref={searchRef}
          placeholder="Team or conference"
          type="search"
          value={query}
        />
      </div>
      <p className={styles.directoryHelp} id="edition-search-help">
        Search by name, or browse a conference below.
      </p>
      <p aria-live="polite" className={styles.directoryCount} role="status">
        {term
          ? `${matches.length} ${matches.length === 1 ? "edition" : "editions"} found.`
          : `${teams.length} teams. Choose a conference.`}
      </p>
      <div className={styles.conferenceGroups}>
        {conferences.map((conference) => {
          const members = matches
            .filter((team) => team.conference === conference)
            .sort((a, b) => a.shortName.localeCompare(b.shortName, "en"));
          const label = (
            <>
              <span>{conference}</span>
              <span className={`${styles.conferenceCount} tnum`}>{members.length}</span>
            </>
          );
          const links = <TeamLinks teams={members} />;

          return term ? (
            <section aria-label={conference} className={styles.conferenceGroup} key={conference}>
              <h3 className={styles.conferenceLabel}>{label}</h3>
              {links}
            </section>
          ) : (
            <details className={styles.conferenceGroup} key={conference} name="edition-conferences">
              <summary className={styles.conferenceLabel}>
                {label}
                <ChevronDown aria-hidden="true" />
              </summary>
              {links}
            </details>
          );
        })}
      </div>
      {term && matches.length === 0 ? (
        <p className={styles.directoryEmpty}>No live edition matches that search.</p>
      ) : null}
      {term ? (
        <button className={styles.directoryReset} onClick={() => {
          setQuery("");
          searchRef.current?.focus();
        }} type="button">
          Show all teams
        </button>
      ) : null}
      <p className={styles.directoryRequest}>
        Don’t see your team? <a className={styles.inlineAction} href="#request">Request an edition</a>
      </p>
    </div>
  );
}

function TeamLinks({ teams }: { teams: DirectoryTeam[] }) {
  return (
    <ul className={styles.directoryTeams}>
      {teams.map((team) => (
        <li key={team.slug}>
          <Link className={styles.directoryLink} href={`/teams/${team.slug}`} prefetch={false}>
            {team.shortName}
            <ArrowRight aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
