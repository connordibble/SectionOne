"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { ExternalLink, Moon, Sun } from "lucide-react";
import { SectionMark } from "@/features/brand/section-mark";
import { Wordmark } from "@/features/brand/wordmark";
import type { TeamConfig } from "@/config/team";
import type {
  KickoffCountdown,
  ScheduleGame,
  TeamSchedule,
} from "@/server/schedule/schedule";
import type { TeamRankingSummary } from "@/server/sources/rankings";
import { formatNewsDate, type WeeklyEdition } from "@/server/sources/weekly";
import { SchedulePreview } from "./schedule-preview";
import { SignalBoard, type WorkspaceSignal } from "./signal-board";
import { TeamChat, type ChatCitation, type DraftRequest } from "./team-chat";
import styles from "./team-workspace.module.css";

export type WorkspaceView = "brief" | "matchup" | "schedule";
type ThemeMode = "light" | "dark";

type TeamOption = {
  slug: string;
  shortName: string;
};

type TeamWorkspaceProps = {
  countdown: KickoffCountdown;
  leadSourceTitle: string;
  nextGame?: ScheduleGame;
  ranking?: TeamRankingSummary;
  schedule?: TeamSchedule;
  scheduleCapturedLabel?: string;
  signals: WorkspaceSignal[];
  starterCitations: ChatCitation[];
  team: TeamConfig;
  teamOptions: TeamOption[];
  themeStyle: CSSProperties;
  weekly?: WeeklyEdition;
};

const views: Array<{ id: WorkspaceView; label: string }> = [
  { id: "brief", label: "Brief" },
  { id: "matchup", label: "Matchup" },
  { id: "schedule", label: "Schedule" },
];

const themeOrder: ThemeMode[] = ["light", "dark"];
const themeLabels: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
};

export function TeamWorkspace({
  countdown,
  leadSourceTitle,
  nextGame,
  ranking,
  schedule,
  scheduleCapturedLabel,
  signals,
  starterCitations,
  team,
  teamOptions,
  themeStyle,
  weekly,
}: TeamWorkspaceProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("brief");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [draftRequest, setDraftRequest] = useState<DraftRequest>();
  const draftId = useRef(0);

  useEffect(() => {
    const syncHash = (focusTab = false) => {
      const hashView = window.location.hash.slice(1);
      const nextView = isWorkspaceView(hashView) ? hashView : "brief";

      setActiveView(nextView);

      if (focusTab) {
        window.requestAnimationFrame(() => {
          document.getElementById(`tab-${nextView}`)?.focus({ preventScroll: true });
        });
      }
    };

    const syncHistory = () => syncHash(true);

    const frame = window.requestAnimationFrame(() => {
      const savedTheme = window.localStorage.getItem("section-one-theme");

      if (isThemeMode(savedTheme)) {
        setThemeMode(savedTheme);
      }
      syncHash();
    });
    window.addEventListener("hashchange", syncHistory);
    window.addEventListener("popstate", syncHistory);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", syncHistory);
      window.removeEventListener("popstate", syncHistory);
    };
  }, []);

  function selectView(view: WorkspaceView, options: { focusTab?: boolean } = {}) {
    setActiveView(view);

    const url = new URL(window.location.href);
    url.hash = view === "brief" ? "" : view;
    if (window.location.hash !== url.hash) {
      window.history.pushState(window.history.state, "", url);
    }

    if (options.focusTab) {
      window.requestAnimationFrame(() => {
        document.getElementById(`tab-${view}`)?.focus({ preventScroll: true });
      });
    }
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
    window.localStorage.setItem("section-one-theme", nextTheme);
  }

  function requestSignalPrompt(prompt: string) {
    draftId.current += 1;
    setDraftRequest({ id: draftId.current, value: prompt });
  }

  return (
    <main
      className={`team-theme ${styles.shell}`}
      data-theme={themeMode}
      data-view={activeView}
      style={themeStyle}
    >
      <a
        className={styles.skipLink}
        href="#workspace-panel"
        onClick={(event) => {
          event.preventDefault();
          const target = document.getElementById("workspace-panel");
          target?.focus({ preventScroll: true });
          target?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to content
      </a>

      <header className={styles.masthead}>
        <div className={styles.editionBar}>
          <div className={styles.editionBarInner}>
            <p className={styles.issueLine}>
              {team.referenceLabel} · {team.conference}
            </p>
            <p className={styles.editionNote}>
              <span>Saturday edition</span>
              <span aria-hidden="true">/</span>
              <span>Independent</span>
            </p>
          </div>
        </div>

        <div className={styles.mastheadInner}>
          <div className={styles.brandSlot}>
            <Wordmark />
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
                  {option.shortName}
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
          tabIndex={-1}
        >
          {activeView === "brief" ? (
            <BriefView
              countdown={countdown}
              game={nextGame}
              issueLabel={team.referenceLabel}
              lead={team.editorial.lead}
              leadSourceTitle={leadSourceTitle}
              ranking={ranking}
              signals={signals}
              teamName={team.shortName}
              weekly={weekly}
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
              onOpenSchedule={() => selectView("schedule", { focusTab: true })}
              schedule={schedule}
              variant="compact"
            />
          </section>
        ) : null}
      </div>

      <footer className={styles.footer} data-testid="source-colophon">
        <div className={styles.footerInner}>
          <SectionMark className={styles.footerMark} />
          <div className={styles.footerCopy}>
            <p>
              <strong>Section One</strong>
              {scheduleCapturedLabel ? ` · Schedule updated ${scheduleCapturedLabel}` : ""}
            </p>
            <p>{team.sourcePolicy.disclaimer}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// The team's own place in the field, not a national top 25.
//
// Most teams are unranked, and for them a list of the best 25 programs in the
// country answers nothing. What a fan of an unranked team actually wants is
// which weeks on their own schedule are the hard ones — so that is the list,
// and the team's own standing is one line above it either way.
function RankingSection({
  ranking,
  teamName,
}: {
  ranking: TeamRankingSummary;
  teamName: string;
}) {
  const { rankedOpponents, opponentCount, teamRank } = ranking;
  const shown = rankedOpponents.slice(0, 5);
  const remaining = rankedOpponents.length - shown.length;

  return (
    <section aria-labelledby="ranking-heading" className={styles.rankingSection}>
      <div className={styles.sectionHeadingRow}>
        <h2 id="ranking-heading">In the field</h2>
        <p className={styles.sectionAside}>
          {ranking.poll.name} · {ranking.weekLabel}
        </p>
      </div>

      <div className={styles.rankingStanding}>
        <p className={styles.rankingFigure}>
          {teamRank === null ? (
            "Unranked"
          ) : (
            <>
              No. <span className="tnum">{teamRank}</span>
            </>
          )}
        </p>
        <p className={styles.rankingContext}>
          {rankedOpponents.length === 0
            ? `No ranked opponents on the ${teamName} schedule.`
            : `${rankedOpponents.length} of ${opponentCount} opponents ranked.`}
        </p>
      </div>

      {shown.length > 0 ? (
        <ol className={styles.rankingList}>
          {shown.map((opponent) => (
            <li key={`${opponent.rank}-${opponent.opponent}`}>
              <span className={`${styles.rankingRank} tnum`}>{opponent.rank}</span>
              <span className={styles.rankingOpponent}>
                {siteWord(opponent.site)} {opponent.opponent}
              </span>
              <span className={`${styles.rankingDate} tnum`}>{opponent.dateLabel}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <p className={styles.rankingNote}>
        {remaining > 0 ? `${remaining} more ranked opponent${remaining === 1 ? "" : "s"}. ` : ""}
        {ranking.pending
          .map((poll) => `The ${poll.name} is out ${poll.expectedLabel}.`)
          .join(" ")}
      </p>
    </section>
  );
}

// Headline, then the one sentence that says why a fan should care, then who
// reported it. The link is the point: we are asking a fan to trust a summary,
// and the least we can do is hand them the thing it was summarised from.
function WeeklyNewsSection({ weekly }: { weekly: WeeklyEdition }) {
  return (
    <section aria-labelledby="news-heading" className={styles.newsSection}>
      <div className={styles.sectionHeadingRow}>
        <h2 id="news-heading">This week</h2>
        <p className={styles.sectionAside}>Updated {formatNewsDate(weekly.publishedAt)}</p>
      </div>

      <p className={styles.newsSummary}>{weekly.summary}</p>

      <ol className={styles.newsList}>
        {weekly.items.map((item, index) => (
          <li key={item.id}>
            <span className={`${styles.newsNumber} tnum`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>
                <a href={item.url} rel="noopener noreferrer" target="_blank">
                  <span>{item.headline}</span>
                  <ExternalLink aria-hidden="true" />
                  <span className={styles.visuallyHidden}>Opens in a new tab</span>
                </a>
              </h3>
              <p>{item.tldr}</p>
              <p className={styles.newsMeta}>
                {item.outlet} · {formatNewsDate(item.publishedAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BriefView({
  countdown,
  game,
  issueLabel,
  lead,
  leadSourceTitle,
  ranking,
  signals,
  teamName,
  weekly,
}: {
  countdown: KickoffCountdown;
  game?: ScheduleGame;
  issueLabel: string;
  lead: TeamConfig["editorial"]["lead"];
  leadSourceTitle: string;
  ranking?: TeamRankingSummary;
  signals: WorkspaceSignal[];
  teamName: string;
  weekly?: WeeklyEdition;
}) {
  return (
    <div className={styles.briefView}>
      <section className={styles.briefLead} data-testid="kickoff-lead">
        <div className={styles.matchupLead}>
          <p className={styles.heroKicker}>
            <span>The Saturday read</span>
            <span>{issueLabel}</span>
          </p>
          <h1>
            {game ? `${teamName} ${siteWord(game.site)} ${game.opponent}` : `${teamName} kickoff`}
          </h1>
          {game ? (
            <p className={`${styles.gameMeta} tnum`}>
              {game.dateLabel} · {game.kickoff} · {game.tv ?? "TV to be announced"}
            </p>
          ) : (
            <p className={styles.gameMeta}>The next kickoff has not been posted.</p>
          )}
          {game ? <p className={styles.venue}>{game.venue}</p> : null}
          <p className={styles.leadTakeaway}>
            <span>The line</span>
            <strong>{lead.headline}</strong>
          </p>
        </div>

        <GameFieldObject countdown={countdown} game={game} teamName={teamName} />
      </section>

      <div className={styles.briefColumns}>
        <section className={styles.mattersSection}>
          <div className={styles.sectionHeadingRow}>
            <p className={styles.sectionFolio}>01 / The plan</p>
            <h2>What matters Saturday</h2>
          </div>
          <ol className={styles.mattersList}>
            {signals.slice(0, 3).map((signal, index) => (
              <li key={signal.id}>
                <span className={`${styles.matterNumber} tnum`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{signal.title}</h3>
                  <p>{signal.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.readSection}>
          <p className={styles.sectionFolio}>02 / Desk read</p>
          <h2>The read</h2>
          <p className={styles.readBody}>{lead.body}</p>
          <p className={styles.readSource}>{leadSourceTitle}</p>
        </section>
      </div>

      <div className={styles.briefLower}>
        {ranking ? <RankingSection ranking={ranking} teamName={teamName} /> : null}
        {weekly ? <WeeklyNewsSection weekly={weekly} /> : null}
      </div>
    </div>
  );
}

function GameFieldObject({
  countdown,
  game,
  teamName,
}: {
  countdown: KickoffCountdown;
  game?: ScheduleGame;
  teamName: string;
}) {
  const label = countdownLabel(countdown);

  return (
    <div
      aria-label={`Kickoff clock: ${label}`}
      className={styles.gameFieldObject}
      data-testid="game-field-object"
      role="img"
    >
      {/* Two layers, because they want opposite things from the same box.
          The grid is ruling and should reach every edge, so it stretches; the
          lines are straight either way. The route carries meaning and must
          stay whole, so it scales to fit. Drawing both in one sliced SVG is
          what cropped the arrowhead off the end of the route. */}
      <div aria-hidden="true" className={styles.fieldDrawing}>
        <svg className={styles.fieldGridLayer} preserveAspectRatio="none" viewBox="0 0 640 420">
          <g className={styles.fieldYardLines}>
            <path d="M80 0V420" />
            <path d="M176 0V420" />
            <path d="M272 0V420" />
            <path d="M368 0V420" />
            <path d="M464 0V420" />
            <path d="M560 0V420" />
            <path d="M0 88H640" />
            <path d="M0 210H640" />
            <path d="M0 332H640" />
          </g>
        </svg>
        <svg
          className={styles.fieldRouteLayer}
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 640 420"
        >
          <g className={styles.fieldHashMarks}>
            <path d="M128 174V194M128 226V246M224 174V194M224 226V246" />
            <path d="M320 174V194M320 226V246M416 174V194M416 226V246" />
            <path d="M512 174V194M512 226V246" />
          </g>
          <path className={styles.fieldRoute} d="M120 302C212 302 236 264 288 206S404 108 512 108" />
          <path className={styles.fieldRouteEcho} d="M120 302L96 286M120 302L96 318" />
          <circle className={styles.fieldRoutePoint} cx="512" cy="108" r="8" />
        </svg>
      </div>

      {/* Drawn in the field's own ink, so it reads as a mark on the surface
          rather than a badge stuck to it. Small and cornered: the figure is
          what this panel is for. */}
      <SectionMark className={styles.fieldMark} />

      <p className={styles.fieldObjectLabel}>Kickoff clock</p>
      <div className={styles.fieldCountdown}>
        <CountdownFigure countdown={countdown} />
      </div>
      <div className={styles.fieldObjectFooter}>
        <span>{game ? `${teamName} ${siteWord(game.site)} ${game.opponent}` : teamName}</span>
        <span className="tnum">{game?.kickoff ?? "Kickoff TBD"}</span>
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

function countdownLabel(countdown: KickoffCountdown): string {
  if (countdown.state === "today") {
    return "Today";
  }

  if (countdown.state === "unscheduled") {
    return "Kickoff to be announced";
  }

  return `${countdown.days} ${countdown.days === 1 ? "day" : "days"} out`;
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
