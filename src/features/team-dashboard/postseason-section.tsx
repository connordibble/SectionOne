import { ArrowRight } from "lucide-react";
import type { TeamPostseason } from "@/lib/postseason/outlook";
import { bowlLine, leadFigure, playoffLine } from "@/lib/postseason/copy";
import { formatNewsDate } from "@/lib/news-date";
import styles from "./team-workspace.module.css";

function phaseAside(outlook: TeamPostseason): string {
  const { playoff } = outlook;
  if (playoff.phase === "field-set") return "Field set";
  if (playoff.phase === "rankings" && playoff.ranking) return `Committee · ${formatNewsDate(playoff.ranking.releasedAt)}`;
  return playoff.nextRanking ? `Rankings start ${formatNewsDate(playoff.nextRanking.date)}` : "Committee rankings";
}

// The Brief carries the one-line version: where the team stands in whichever
// race is live, the other race in a sentence, and the way into the full view.
export function PostseasonSection({ outlook, onOpen }: { outlook: TeamPostseason; onOpen: () => void }) {
  const lead = leadFigure(outlook);
  const other = outlook.lead === "bowl" ? playoffLine(outlook.playoff, outlook.record) : bowlLine(outlook.bowl);

  return (
    <section aria-labelledby="postseason-summary-heading" className={styles.postseasonSection} data-lead={outlook.lead}>
      <div className={styles.sectionHeadingRow}>
        <h2 id="postseason-summary-heading">Postseason</h2>
        <p className={styles.sectionAside}>{phaseAside(outlook)}</p>
      </div>
      <div className={styles.rankingStanding}>
        <p className={styles.rankingFigure}>
          <span className="tnum">{lead.figure}</span>
          {lead.unit ? <span className={styles.postseasonUnit}> {lead.unit}</span> : null}
        </p>
        <p className={styles.rankingContext}>
          <span className={styles.postseasonLeadLabel}>{outlook.lead === "bowl" ? "Bowl race" : "Playoff race"}</span>
          {lead.context}
        </p>
      </div>
      <p className={styles.postseasonOther}>{other}</p>
      <button className={styles.scheduleLink} onClick={onOpen} type="button">
        Bracket, rankings and dates
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}
