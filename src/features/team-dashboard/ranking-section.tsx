import type { RankedOpponent, TeamRankingSummary } from "@/server/sources/rankings";
import { formatNewsDate } from "@/lib/news-date";
import { safeExternalHref } from "@/lib/safe-url";
import { FinalScore } from "./final-score";
import styles from "./team-workspace.module.css";

const groups = [
  { phase: "upcoming", label: "Upcoming" },
  { phase: "played", label: "Played" },
  { phase: "updates", label: "Game updates" },
] as const;

function OpponentResult({ opponent }: { opponent: RankedOpponent }) {
  if (opponent.status === "final" && opponent.result) {
    return <FinalScore result={opponent.result} className={styles.rankingResult} />;
  }
  const label = opponent.status === "final" ? "Final"
    : opponent.status === "in-progress" ? "In progress"
    : opponent.status === "postponed" ? "Postponed"
    : opponent.status === "cancelled" ? "Cancelled"
    : opponent.phase === "updates" ? "Result pending" : null;
  return label ? <span className={styles.rankingStatus}>{label}</span> : null;
}

export function RankingSection({ ranking, teamName }: { ranking: TeamRankingSummary; teamName: string }) {
  const { rankedOpponents, opponentCount, teamRank } = ranking;
  return (
    <section aria-labelledby="ranking-heading" className={styles.rankingSection}>
      <div className={styles.sectionHeadingRow}>
        <h2 id="ranking-heading">In the field</h2>
        <p className={styles.sectionAside}>{ranking.poll.name} · {ranking.weekLabel}</p>
      </div>
      <div className={styles.rankingStanding}>
        <p className={styles.rankingFigure} data-unranked={teamRank === null ? "true" : undefined}>
          {teamRank === null ? "Unranked" : <>No. <span className="tnum">{teamRank}</span></>}
        </p>
        <p className={styles.rankingContext}>
          {rankedOpponents.length === 0
            ? `No ${ranking.missingGameDayRanks ? "verified " : ""}ranked opponents on the ${teamName} schedule.`
            : `${rankedOpponents.length} of ${opponentCount} opponents ranked.`}
        </p>
      </div>
      {groups.map(({ phase, label }) => {
        const opponents = rankedOpponents.filter((opponent) => opponent.phase === phase);
        if (!opponents.length) return null;
        const headingId = `ranking-${phase}-heading`;
        return (
          <div key={phase} className={styles.rankingGroup}>
            <h3 id={headingId} className={styles.rankingGroupHeading}>
              {label}{phase !== "upcoming" ? " · AP at kickoff" : ""}<span className="tnum">{opponents.length}</span>
            </h3>
            <ol className={styles.rankingList} aria-labelledby={headingId}>
              {opponents.map((opponent) => (
                <li key={opponent.gameId}>
                  <span className={`${styles.rankingRank} tnum`}>
                    {opponent.rankSourceUrl ? <a href={safeExternalHref(opponent.rankSourceUrl)} target="_blank" rel="noreferrer" aria-label={`No. ${opponent.rank} ${opponent.opponent}, AP rank at kickoff: source`}>{opponent.rank}</a> : opponent.rank}
                  </span>
                  <span className={styles.rankingOpponent}>
                    {opponent.site === "away" ? "at" : "vs"} {opponent.opponent}
                  </span>
                  <OpponentResult opponent={opponent} />
                  <span className={`${styles.rankingDate} tnum`}>{opponent.dateLabel}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
      <p className={styles.rankingNote}>
        Upcoming opponents use this AP poll. Played opponents use their AP rank at kickoff.{" "}
        <a href={safeExternalHref(ranking.poll.sourceUrl)} target="_blank" rel="noreferrer">
          Poll published {formatNewsDate(ranking.poll.releasedAt)}
        </a>{". "}Checked {formatNewsDate(ranking.checkedAt)}.
        {rankedOpponents.some((opponent) => opponent.phase === "played") && ranking.scheduleSource ? <>{" "}
          <a href={safeExternalHref(ranking.scheduleSource.url)} target="_blank" rel="noreferrer">
            Results checked {formatNewsDate(ranking.scheduleSource.checkedAt)}
          </a>.
        </> : null}
        {ranking.missingGameDayRanks ? ` ${ranking.missingGameDayRanks} game-day ${ranking.missingGameDayRanks === 1 ? "ranking is" : "rankings are"} not yet verified; those games are excluded from the ranked-opponent count.` : ""}
        {ranking.pending.map((poll) => ` The ${poll.name} is out ${poll.expectedLabel}.`).join("")}
      </p>
    </section>
  );
}
