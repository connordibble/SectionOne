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
  thin: "Still unknown",
};

export function SignalBoard({ onAsk, signals, thesis }: SignalBoardProps) {
  const [selectedId, setSelectedId] = useState(signals[0]?.id);
  const selected = signals.find((signal) => signal.id === selectedId) ?? signals[0];
  const selectedIndex = Math.max(
    0,
    signals.findIndex((signal) => signal.id === selected.id),
  );

  if (!selected) {
    return null;
  }

  return (
    <section className={styles.signalSection} data-testid="signal-board">
      <div className={styles.signalHeading}>
        <div>
          <p className={styles.signalKicker}>02 / Field geometry</p>
          <h1>Matchup map</h1>
          <p>Four keys arranged around the game. Pick one for the focused read.</p>
        </div>
        <p className={styles.boardInstruction}>
          <span className="tnum">01–04</span> · Choose a key
        </p>
      </div>

      <div className={styles.signalField}>
        <svg
          aria-hidden="true"
          className={styles.fieldBlueprint}
          preserveAspectRatio="none"
          viewBox="0 0 1200 720"
        >
          <g className={styles.blueprintLines}>
            <path d="M120 48V672M280 48V672M440 48V672M600 48V672" />
            <path d="M760 48V672M920 48V672M1080 48V672" />
            <path d="M48 120H1152M48 360H1152M48 600H1152" />
          </g>
          <g className={styles.blueprintHashes}>
            <path d="M200 316V344M200 376V404M360 316V344M360 376V404" />
            <path d="M520 316V344M520 376V404M680 316V344M680 376V404" />
            <path d="M840 316V344M840 376V404M1000 316V344M1000 376V404" />
          </g>
          <g className={styles.blueprintRoutes}>
            <path d="M118 566C270 566 322 506 390 414S520 234 638 180" />
            <path d="M1080 568C940 568 884 514 826 440S742 334 664 322" />
            <path d="M1080 154H916C832 154 794 194 744 270" />
          </g>
        </svg>

        <div aria-hidden="true" className={styles.fieldMarks}>
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div aria-label="Signal keys" className={styles.signalChoices} role="group">
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
              <span aria-hidden="true" className={styles.nodeMarker}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.nodeTopline}>
                <span className={styles.nodeState} data-state={signal.state}>
                  <span aria-hidden="true" />
                  {stateLabels[signal.state]}
                </span>
                <span className={`${styles.nodeIndex} tnum`}>Key 0{index + 1}</span>
              </span>
              <strong>{signal.title}</strong>
              <span className={styles.nodeSummary}>{signal.summary}</span>
            </button>
          ))}
        </div>

        <div aria-live="polite" className={styles.signalCenter} key={selected.id}>
          <div className={styles.signalCenterTopline}>
            <p className={styles.signalDetailLabel}>
              Key {String(selectedIndex + 1).padStart(2, "0")} · {stateLabels[selected.state]}
            </p>
            <p className={styles.boardThesis}>{thesis}</p>
          </div>
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
