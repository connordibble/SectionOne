import { ExternalLink } from "lucide-react";
import type { SourceState } from "@/config/team";
import styles from "./team-workspace.module.css";
import { safeExternalHref } from "@/lib/safe-url";

type SourceLedgerProps = {
  capturedLabel?: string;
  disclaimer: string;
  scheduleUrl?: string;
  sources: SourceState[];
};

export function SourceLedger({
  capturedLabel,
  disclaimer,
  scheduleUrl,
  sources,
}: SourceLedgerProps) {
  const readyCount = sources.filter((source) => source.state === "Ready").length;

  return (
    <section className={styles.sourcesView}>
      <div className={styles.sourcesHeading}>
        <div>
          <h2>Source ledger</h2>
          <p>The record behind every answer, including the gaps that still matter.</p>
        </div>
        <p className={`${styles.sourceCount} tnum`}>
          {readyCount} / {sources.length} ready
        </p>
      </div>

      <ol className={styles.sourceList}>
        {sources.map((source) => {
          const href =
            source.id === "schedule" ? safeExternalHref(scheduleUrl) : undefined;

          return (
            <li key={source.id}>
              <span aria-hidden="true" className={styles.sourceMark} data-state={source.state} />
              <div>
                <h3>{source.label}</h3>
                <p>{source.description}</p>
                {source.id === "schedule" && capturedLabel ? (
                  <span className={`${styles.sourceFreshness} tnum`}>
                    Checked {capturedLabel}
                  </span>
                ) : null}
              </div>
              {href ? (
                <a className={styles.sourceLink} href={href} rel="noreferrer" target="_blank">
                  Open source
                  <ExternalLink aria-hidden="true" />
                </a>
              ) : (
                <span className={styles.sourceStatus}>{source.state}</span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.sourceMethod}>
        <div>
          <h3>What “ready” means</h3>
          <p>
            The source is available to retrieval, carries a capture date, and can be
            named beside the claim it supports. Planned sources never silently stand in
            for evidence.
          </p>
        </div>
        <p>{disclaimer}</p>
      </div>
    </section>
  );
}
