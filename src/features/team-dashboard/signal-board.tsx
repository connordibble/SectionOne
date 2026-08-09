"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { TeamConfig } from "@/config/team";
import styles from "./team-workspace.module.css";

export type WorkspaceSignal = TeamConfig["editorial"]["signals"][number] & {
  sourceTitle: string;
};

type SignalBoardProps = {
  onAsk: (prompt: string) => void;
  signals: WorkspaceSignal[];
  thesis: string;
};

const stateLabels: Record<WorkspaceSignal["state"], string> = {
  watch: "Watch",
  ready: "Ready",
  thin: "Thin evidence",
};

export function SignalBoard({ onAsk, signals, thesis }: SignalBoardProps) {
  const [selectedId, setSelectedId] = useState(signals[0]?.id);
  const selected = signals.find((signal) => signal.id === selectedId) ?? signals[0];

  if (!selected) {
    return null;
  }

  return (
    <section className={styles.signalSection} data-testid="signal-board">
      <div className={styles.signalHeading}>
        <div>
          <h2>Signal board</h2>
          <p>Four cues that turn the opener from a score check into a useful read.</p>
        </div>
        <p className={styles.boardInstruction}>Choose a cue to sharpen the read.</p>
      </div>

      <div className={styles.signalField}>
        <div aria-hidden="true" className={styles.fieldMarks}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        {signals.map((signal, index) => (
          <button
            aria-pressed={selected.id === signal.id}
            className={styles.signalNode}
            data-position={index + 1}
            data-state={signal.state}
            key={signal.id}
            onClick={() => setSelectedId(signal.id)}
            type="button"
          >
            <span className={styles.nodeTopline}>
              <span className={styles.nodeState}>
                <span aria-hidden="true" />
                {stateLabels[signal.state]}
              </span>
              <span className={`${styles.nodeIndex} tnum`}>0{index + 1}</span>
            </span>
            <strong>{signal.title}</strong>
            <span className={styles.nodeSummary}>{signal.summary}</span>
          </button>
        ))}

        <div aria-live="polite" className={styles.signalCenter} key={selected.id}>
          <p className={styles.boardThesis}>{thesis}</p>
          <h3>{selected.title}</h3>
          <p>{selected.detail}</p>
          <button
            className={styles.askSignal}
            onClick={() => onAsk(selected.prompt)}
            type="button"
          >
            Ask about this
            <ArrowRight aria-hidden="true" />
          </button>
          <span className={styles.boardSource}>{selected.sourceTitle}</span>
        </div>
      </div>
    </section>
  );
}
