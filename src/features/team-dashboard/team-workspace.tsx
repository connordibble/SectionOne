"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import type { SourceState, TeamConfig } from "@/config/team";
import type {
  KickoffCountdown,
  ScheduleGame,
  TeamSchedule,
} from "@/server/schedule/schedule";
import { SchedulePreview } from "./schedule-preview";
import { SignalBoard, type WorkspaceSignal } from "./signal-board";
import { SourceLedger } from "./source-ledger";
import { TeamChat, type ChatCitation, type DraftRequest } from "./team-chat";
import styles from "./team-workspace.module.css";

export type WorkspaceView = "brief" | "matchup" | "schedule" | "sources";
type ThemeMode = "system" | "light" | "dark";

type TeamOption = {
  slug: string;
  shortName: string;
  conference: string;
};

type TeamWorkspaceProps = {
  countdown: KickoffCountdown;
  leadSourceTitle: string;
  nextGame?: ScheduleGame;
  schedule?: TeamSchedule;
  scheduleCapturedLabel?: string;
  signals: WorkspaceSignal[];
  sourceStates: SourceState[];
  starterCitations: ChatCitation[];
  team: TeamConfig;
  teamOptions: TeamOption[];
  themeStyle: CSSProperties;
};

const views: Array<{ id: WorkspaceView; label: string }> = [
  { id: "brief", label: "Brief" },
  { id: "matchup", label: "Matchup" },
  { id: "schedule", label: "Schedule" },
  { id: "sources", label: "Sources" },
];

const themeOrder: ThemeMode[] = ["system", "light", "dark"];
const themeLabels: Record<ThemeMode, string> = {
  system: "Auto",
  light: "Light",
  dark: "Dark",
};

export function TeamWorkspace({
  countdown,
  leadSourceTitle,
  nextGame,
  schedule,
  scheduleCapturedLabel,
  signals,
  sourceStates,
  starterCitations,
  team,
  teamOptions,
  themeStyle,
}: TeamWorkspaceProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("brief");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [draftRequest, setDraftRequest] = useState<DraftRequest>();
  const draftId = useRef(0);

  useEffect(() => {
    const syncHash = () => {
      const hashView = window.location.hash.slice(1);

      if (isWorkspaceView(hashView)) {
        setActiveView(hashView);
      } else {
        setActiveView("brief");
      }
    };

    const frame = window.requestAnimationFrame(() => {
      const savedTheme = window.localStorage.getItem("saturday-signal-theme");

      if (isThemeMode(savedTheme)) {
        setThemeMode(savedTheme);
      }
      syncHash();
    });
    window.addEventListener("hashchange", syncHash);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", syncHash);
    };
  }, []);

  function selectView(view: WorkspaceView) {
    setActiveView(view);

    const url = new URL(window.location.href);
    url.hash = view === "brief" ? "" : view;
    window.history.replaceState(window.history.state, "", url);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLElement>) {
    const currentIndex = views.findIndex((view) => view.id === activeView);
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % views.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + views.length) % views.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = views.length - 1;
    }

    if (nextIndex === undefined) {
      return;
    }

    event.preventDefault();
    const nextView = views[nextIndex];
    selectView(nextView.id);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#tab-${nextView.id}`)
      ?.focus({ preventScroll: true });
  }

  function cycleTheme() {
    const nextTheme = themeOrder[(themeOrder.indexOf(themeMode) + 1) % themeOrder.length];
    setThemeMode(nextTheme);
    window.localStorage.setItem("saturday-signal-theme", nextTheme);
  }

  function requestSignalPrompt(prompt: string) {
    draftId.current += 1;
    setDraftRequest({ id: draftId.current, value: prompt });
  }

  const readySourceCount = sourceStates.filter((source) => source.state === "Ready").length;

  return (
    <main
      className={`team-theme ${styles.shell}`}
      data-theme={themeMode}
      data-view={activeView}
      style={themeStyle}
    >
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.brandBlock}>
            <h1 aria-label="Saturday Signal" className={styles.wordmark}>
              <Link aria-label="Saturday Signal home" href="/">
                <span>Saturday </span>
                <span className={styles.wordmarkSignal}>Signal</span>
              </Link>
            </h1>
            <p className={styles.issueLine}>
              {team.referenceLabel} · {team.conference} · Independent coverage
            </p>
          </div>

          <nav
            aria-label="Coverage views"
            aria-orientation="horizontal"
            className={styles.tabs}
            onKeyDown={handleTabKeyDown}
            role="tablist"
          >
            {views.map((view) => (
              <button
                aria-controls="workspace-panel"
                aria-selected={activeView === view.id}
                className={styles.tab}
                id={`tab-${view.id}`}
                key={view.id}
                onClick={() => selectView(view.id)}
                role="tab"
                tabIndex={activeView === view.id ? 0 : -1}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </nav>

          <div className={styles.headerControls}>
            <label className={styles.visuallyHidden} htmlFor="team-switcher">
              Team
            </label>
            <select
              aria-label="Team"
              className={styles.teamSwitcher}
              id="team-switcher"
              onChange={(event) => {
                if (event.currentTarget.value !== team.slug) {
                  window.location.assign(`/teams/${event.currentTarget.value}`);
                }
              }}
              value={team.slug}
            >
              {teamOptions.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.shortName} · {option.conference}
                </option>
              ))}
            </select>
            <button
              aria-label={`Color theme: ${themeLabels[themeMode]}. Change theme.`}
              className={styles.themeToggle}
              onClick={cycleTheme}
              title={`Theme: ${themeLabels[themeMode]}`}
              type="button"
            >
              {themeMode === "system" ? <Monitor aria-hidden="true" /> : null}
              {themeMode === "light" ? <Sun aria-hidden="true" /> : null}
              {themeMode === "dark" ? <Moon aria-hidden="true" /> : null}
              <span>{themeLabels[themeMode]}</span>
            </button>
          </div>
        </div>
      </header>

      {activeView !== "brief" && nextGame ? (
        <GameStrip countdown={countdown} game={nextGame} teamName={team.shortName} />
      ) : null}

      <div className={styles.workspace} data-view={activeView}>
        <section
          aria-labelledby={`tab-${activeView}`}
          className={`${styles.primaryView} ${styles.viewEntrance}`}
          id="workspace-panel"
          role="tabpanel"
          tabIndex={0}
        >
          {activeView === "brief" ? (
            <BriefView
              countdown={countdown}
              game={nextGame}
              lead={team.editorial.lead}
              leadSourceTitle={leadSourceTitle}
              signals={signals}
              teamName={team.shortName}
            />
          ) : null}
          {activeView === "matchup" ? (
            <SignalBoard
              onAsk={requestSignalPrompt}
              signals={signals}
              thesis={team.editorial.matchup.thesis}
            />
          ) : null}
          {activeView === "schedule" ? (
            <SchedulePreview
              nextGameId={nextGame?.id}
              schedule={schedule}
              variant="full"
            />
          ) : null}
          {activeView === "sources" ? (
            <SourceLedger
              capturedLabel={scheduleCapturedLabel}
              disclaimer={team.sourcePolicy.disclaimer}
              scheduleUrl={schedule?.sourceUrl}
              sources={sourceStates}
            />
          ) : null}
        </section>

        <aside className={styles.chatDock} data-testid="team-chat-panel">
          <TeamChat
            draftRequest={draftRequest}
            mode={activeView}
            starterRead={{
              question: team.editorial.matchup.question,
              answer: team.editorial.matchup.answer,
              citations: starterCitations,
            }}
            suggestedPrompts={team.suggestedPrompts}
            tagline={team.tagline}
            teamSlug={team.slug}
          />
        </aside>

        {activeView === "brief" ? (
          <section className={styles.secondaryView}>
            <SchedulePreview
              nextGameId={nextGame?.id}
              onOpenSchedule={() => selectView("schedule")}
              schedule={schedule}
              variant="compact"
            />
          </section>
        ) : null}
      </div>

      <footer className={styles.footer} data-testid="source-colophon">
        <div className={styles.footerInner}>
          <p>
            <strong>Saturday Signal</strong> · {readySourceCount} of {sourceStates.length} source
            desks ready
            {scheduleCapturedLabel ? ` · Schedule checked ${scheduleCapturedLabel}` : ""}
          </p>
          <p>{team.sourcePolicy.disclaimer}</p>
        </div>
      </footer>
    </main>
  );
}

function BriefView({
  countdown,
  game,
  lead,
  leadSourceTitle,
  signals,
  teamName,
}: {
  countdown: KickoffCountdown;
  game?: ScheduleGame;
  lead: TeamConfig["editorial"]["lead"];
  leadSourceTitle: string;
  signals: WorkspaceSignal[];
  teamName: string;
}) {
  return (
    <div className={styles.briefView}>
      <section className={styles.briefLead} data-testid="kickoff-lead">
        <CountdownFigure countdown={countdown} />
        <div className={styles.matchupLead}>
          <p className={styles.leadContext}>Next Saturday</p>
          <h2>
            {game ? `${teamName} ${siteWord(game.site)} ${game.opponent}` : `${teamName} kickoff`}
          </h2>
          {game ? (
            <p className={`${styles.gameMeta} tnum`}>
              {game.dateLabel} · {game.kickoff} · {game.tv ?? "TV to be announced"}
            </p>
          ) : (
            <p className={styles.gameMeta}>The next kickoff has not been posted.</p>
          )}
          {game ? <p className={styles.venue}>{game.venue}</p> : null}
        </div>
      </section>

      <div className={styles.briefColumns}>
        <section className={styles.mattersSection}>
          <div className={styles.sectionHeadingRow}>
            <h2>What matters</h2>
            <span>{signals.length} active reads</span>
          </div>
          <ol className={styles.mattersList}>
            {signals.slice(0, 3).map((signal, index) => (
              <li key={signal.id}>
                <span className={`${styles.matterNumber} tnum`}>{index + 1}</span>
                <div>
                  <h3>{signal.title}</h3>
                  <p>{signal.summary}</p>
                </div>
                <SignalState state={signal.state} />
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.readSection}>
          <h2>The read</h2>
          <p className={styles.readHeadline}>{lead.headline}</p>
          <p className={styles.readBody}>{lead.body}</p>
          <p className={styles.readSource}>{leadSourceTitle}</p>
        </section>
      </div>
    </div>
  );
}

function CountdownFigure({ countdown }: { countdown: KickoffCountdown }) {
  if (countdown.state === "today") {
    return <p className={styles.todayFigure}>Today</p>;
  }

  if (countdown.state === "unscheduled") {
    return <p className={styles.tbdFigure}>TBD</p>;
  }

  return (
    <p className={styles.countdownFigure}>
      <span className="tnum">{countdown.days}</span>
      <span>{countdown.days === 1 ? "day out" : "days out"}</span>
    </p>
  );
}

function GameStrip({
  countdown,
  game,
  teamName,
}: {
  countdown: KickoffCountdown;
  game: ScheduleGame;
  teamName: string;
}) {
  const countdownLabel =
    countdown.state === "scheduled"
      ? `${countdown.days} ${countdown.days === 1 ? "day" : "days"}`
      : countdown.state === "today"
        ? "Today"
        : "Kickoff TBD";

  return (
    <section aria-label="Next game" className={styles.gameStrip}>
      <div className={styles.gameStripInner}>
        <p className={`${styles.stripCountdown} tnum`}>{countdownLabel}</p>
        <p className={styles.stripMatchup}>
          {teamName} {siteWord(game.site)} {game.opponent}
        </p>
        <p className={`${styles.stripMeta} tnum`}>
          {shortDate(game.dateLabel)} · {game.kickoff} · {game.tv ?? "TV TBD"}
        </p>
      </div>
    </section>
  );
}

function SignalState({ state }: { state: WorkspaceSignal["state"] }) {
  const labels: Record<WorkspaceSignal["state"], string> = {
    watch: "Watch",
    ready: "Ready",
    thin: "Thin evidence",
  };

  return (
    <span className={styles.signalState} data-state={state}>
      <span aria-hidden="true" />
      {labels[state]}
    </span>
  );
}

function siteWord(site: ScheduleGame["site"]): string {
  return site === "away" ? "at" : "vs";
}

function shortDate(dateLabel: string): string {
  return dateLabel.replace(/^\w+day,\s*/, "");
}

function isWorkspaceView(value: string): value is WorkspaceView {
  return views.some((view) => view.id === value);
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && themeOrder.includes(value as ThemeMode);
}
