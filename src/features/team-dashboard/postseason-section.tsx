import Link from "next/link";
import { contentionLossLimit, type TeamPostseason } from "@/lib/postseason/outlook";
import {
  bowlLine, leadFigure, pathLine, playoffLine, rankingStatusLine, recordDetail,
} from "@/lib/postseason/copy";
import { formatNewsDate } from "@/lib/news-date";
import { safeExternalHref } from "@/lib/safe-url";
import styles from "./team-workspace.module.css";

const lossWords = ["no", "one", "two", "three"];

function phaseAside(outlook: TeamPostseason): string {
  const { playoff } = outlook;
  if (playoff.phase === "field-set") return "Field set";
  if (playoff.phase === "rankings" && playoff.ranking) return `Committee · ${formatNewsDate(playoff.ranking.releasedAt)}`;
  return playoff.nextRanking ? `Rankings start ${formatNewsDate(playoff.nextRanking.date)}` : "Committee rankings";
}

// Read from the team outward, like the rankings above it: the team's own
// standing first, then its path, then the bowl race. When the team is out of
// the playoff picture the bowl race leads, and the playoff rows stay below it.
export function PostseasonSection({ outlook, teamName }: { outlook: TeamPostseason; teamName: string }) {
  const lead = leadFigure(outlook);
  const { playoff, bowl, record } = outlook;
  const behind = rankingStatusLine(playoff);
  const rows = [
    { label: "Record", value: recordDetail(record) },
    { label: "Playoff", value: playoffLine(playoff, record) },
    { label: "Path", value: pathLine(playoff) },
    { label: "Bowl", value: bowlLine(bowl) },
  ];
  // The race that leads is stated once, beside the figure; its row is not
  // repeated underneath.
  const ordered = rows.filter((row) => row.label !== (outlook.lead === "bowl" ? "Bowl" : "Playoff"));
  const rankingHref = playoff.ranking ? safeExternalHref(playoff.ranking.sourceUrl) : undefined;
  const fieldHref = playoff.fieldSourceUrl ? safeExternalHref(playoff.fieldSourceUrl) : undefined;
  const selectionHref = bowl.selection ? safeExternalHref(bowl.selection.sourceUrl) : undefined;

  return (
    <section aria-labelledby="postseason-heading" className={styles.postseasonSection} data-lead={outlook.lead} id="postseason">
      <div className={styles.sectionHeadingRow}>
        <h2 id="postseason-heading">Postseason</h2>
        <p className={styles.sectionAside}>{phaseAside(outlook)}</p>
      </div>
      <div className={styles.rankingStanding}>
        <p className={styles.rankingFigure}>
          <span className="tnum">{lead.figure}</span>
          {lead.unit ? <span className={styles.postseasonUnit}> {lead.unit}</span> : null}
        </p>
        <p className={styles.rankingContext}>
          <span className={styles.postseasonLeadLabel}>{outlook.lead === "bowl" ? "Bowl race" : "Playoff race"}</span>{" "}
          {lead.context}
        </p>
      </div>
      <dl className={styles.postseasonFacts}>
        {ordered.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.rankingNote}>
        {playoff.phase === "before-rankings"
          ? `“In the picture” means ranked in the AP poll or no more than ${lossWords[contentionLossLimit] ?? contentionLossLimit} losses. It is a reading of the record, not a forecast. `
          : null}
        {playoff.phase === "rankings" && playoff.ranking ? <>
          A committee rank is not a seed; conference champions can move the line.{" "}
          {rankingHref ? <a href={rankingHref} rel="noreferrer" target="_blank">Committee ranking {formatNewsDate(playoff.ranking.releasedAt)}</a> : null}.{" "}
        </> : null}
        {behind ? `${behind} ` : null}
        {fieldHref && playoff.fieldAnnouncedAt ? <><a href={fieldHref} rel="noreferrer" target="_blank">Field announced {formatNewsDate(playoff.fieldAnnouncedAt)}</a>. </> : null}
        {selectionHref && bowl.selection ? <><a href={selectionHref} rel="noreferrer" target="_blank">Bowl announced {formatNewsDate(bowl.selection.announcedAt)}</a>. </> : null}
        Record from {teamName} results checked {formatNewsDate(outlook.scheduleCheckedAt)}. Rules checked {formatNewsDate(outlook.rulesCheckedAt)}.{" "}
        <Link className={styles.postseasonLink} href="/playoff">See the full playoff race</Link>
      </p>
    </section>
  );
}
