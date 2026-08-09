import type { CSSProperties } from "react";
import { deriveTeamPalette, getSourceReadiness, type TeamConfig } from "@/config/team";
import {
  formatCaptureDate,
  formatSite,
  getKickoffCountdown,
  getNextGame,
  getTeamSchedule,
  type KickoffCountdown,
} from "@/server/schedule/schedule";
import { SchedulePreview } from "./schedule-preview";
import { TeamChat } from "./team-chat";

type TeamDashboardProps = {
  team: TeamConfig;
};

export function TeamDashboard({ team }: TeamDashboardProps) {
  const nextGame = getNextGame(team.slug);
  const schedule = getTeamSchedule(team.slug);
  const sourceStates = getSourceReadiness(team);
  const readySourceCount = sourceStates.filter((source) => source.state === "Ready").length;
  const countdown = getKickoffCountdown(nextGame);

  return (
    <main
      className="min-h-screen bg-[var(--team-page)] text-[var(--team-ink)]"
      style={createTeamThemeStyle(team)}
    >
      {/* Masthead. A sports section opens with a nameplate, not a nav bar —
          the page has one destination, so chrome that implies navigation
          would be lying about the information architecture. */}
      <header className="bg-[var(--team-steel)] text-[var(--team-contrast)]">
        {/* Two rows on small screens, one on wide. Letting all three items
            wrap freely put the trust badge on its own orphan line and split
            the reference label in half. */}
        <div className="mx-auto grid w-full max-w-[1180px] gap-x-4 gap-y-0.5 px-4 py-3 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-baseline">
          {/* A normal space, not &nbsp; — the entity leaks into the accessible
              name and breaks any query for "Saturday Signal". Wrapping is
              prevented with whitespace-nowrap instead. */}
          <h1 className="whitespace-nowrap text-[length:var(--text-xl)] font-semibold leading-none tracking-tight">
            Saturday <span className="text-[var(--team-accent-soft)]">Signal</span>
          </h1>
          <p className="flex min-w-0 items-baseline gap-x-2 text-[length:var(--text-xs)] leading-5 opacity-75 md:contents">
            <span className="truncate md:min-w-0 md:truncate">{team.referenceLabel}</span>
            <span
              aria-hidden="true"
              className="shrink-0 opacity-50 md:hidden"
            >
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap text-[length:var(--text-2xs)] uppercase tracking-wide opacity-80 md:text-[length:var(--text-2xs)] md:opacity-70">
              Independent fan project
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
        {nextGame ? (
          <section
            // items-start, not items-end: the qualifier block is several lines
            // tall, so bottom-aligning drops the figure well below the
            // headline and the two stop reading as one sentence.
            className="grid gap-x-8 gap-y-3 border-b border-[var(--team-border-strong)] py-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:py-8"
            data-testid="kickoff-lead"
          >
            <CountdownFigure countdown={countdown} />

            <div className="min-w-0">
              <h2 className="text-[length:var(--text-2xl)] font-semibold leading-[1.15] tracking-tight text-balance sm:text-[length:var(--text-3xl)]">
                {team.shortName} {formatSite(nextGame.site)} {nextGame.opponent}
              </h2>
              <p className="tnum mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--text-sm)] leading-6 text-[var(--team-ink-subtle)]">
                <span>{nextGame.dateLabel}</span>
                <Sep />
                <span>{nextGame.kickoff}</span>
                <Sep />
                <span>{nextGame.tv ?? "TV to be announced"}</span>
              </p>
              <p className="mt-1 text-[length:var(--text-sm)] leading-6 text-[var(--team-muted)]">
                {nextGame.venue}
              </p>
              <p className="mt-3 max-w-[62ch] border-l-2 border-[var(--team-accent)] pl-3 text-[length:var(--text-sm)] leading-6 text-[var(--team-ink-subtle)]">
                {team.nextGameNote}
              </p>
            </div>
          </section>
        ) : null}

        {/* The chat is the product, so it gets the page's main column with no
            panel chrome around it. The previous build boxed it behind a
            titled header bar, which read as a widget parked on a dashboard. */}
        <section
          className="border-b border-[var(--team-border)] py-6 md:py-8"
          data-testid="team-chat-panel"
        >
          <TeamChat
            compactTagline={`${team.shortName} signal, sourced.`}
            suggestedPrompts={team.suggestedPrompts}
            tagline={team.tagline}
            teamSlug={team.slug}
          />
        </section>

        <SchedulePreview teamSlug={team.slug} />

        {/* Colophon. Sourcing belongs at the foot of the page the way a
            masthead credit does — present and checkable, not competing with
            the fixture table for attention. */}
        <footer
          className="border-t border-[var(--team-border)] py-6 text-[length:var(--text-xs)] leading-5 text-[var(--team-muted)]"
          data-testid="source-colophon"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-semibold text-[var(--team-ink-subtle)]">
              Sources
            </span>
            <span className="tnum">
              {readySourceCount} of {sourceStates.length} ready
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {sourceStates.map((source) => (
              <li className="flex items-baseline gap-1.5" key={source.label}>
                <span
                  aria-hidden="true"
                  className={`inline-block size-1.5 shrink-0 translate-y-[-1px] rounded-full ${
                    source.state === "Ready"
                      ? "bg-[var(--team-accent)]"
                      : "bg-[var(--team-border-strong)]"
                  }`}
                />
                <span>{source.label}</span>
                <span className="text-[var(--team-ink-subtle)]">{source.state}</span>
              </li>
            ))}
          </ul>
          {schedule ? (
            <p className="mt-3">
              Official schedule fixture captured {formatCaptureDate(schedule.capturedAt)}.
            </p>
          ) : null}
          <p className="mt-2 max-w-[80ch]">
            {team.sourcePolicy.disclaimer} Saturday Signal avoids official marks and uses
            source-backed football context.
          </p>
        </footer>
      </div>
    </main>
  );
}

// The lead figure. Stat-Led's rule is that the number never stands alone as the
// headline — the worded line beside it completes the sentence. An unscheduled
// kickoff renders "TBD" rather than a fabricated count, because the figure has
// to be honest to be worth this much of the page.
function CountdownFigure({ countdown }: { countdown: KickoffCountdown }) {
  if (countdown.state === "today") {
    return (
      <p className="text-[length:var(--text-figure)] font-semibold leading-[0.82] tracking-tight text-[var(--team-accent)]">
        Today
      </p>
    );
  }

  if (countdown.state === "unscheduled") {
    return (
      <p className="text-[length:var(--text-figure)] font-semibold leading-[0.82] tracking-tight text-[var(--team-border-strong)]">
        TBD
      </p>
    );
  }

  return (
    <p className="flex items-baseline gap-2 text-[var(--team-accent)]">
      <span className="tnum text-[length:var(--text-figure)] font-semibold leading-[0.82] tracking-tight">
        {countdown.days}
      </span>
      <span className="text-[length:var(--text-lg)] font-medium leading-tight text-[var(--team-ink-subtle)]">
        {countdown.days === 1 ? "day out" : "days out"}
      </span>
    </p>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="text-[var(--team-border-strong)]">
      ·
    </span>
  );
}

function createTeamThemeStyle(team: TeamConfig) {
  const palette = deriveTeamPalette(team.theme);

  return {
    "--team-page": palette.page,
    "--team-surface": palette.surface,
    "--team-surface-soft": palette.surfaceSoft,
    "--team-surface-strong": palette.surfaceStrong,
    "--team-ink": palette.ink,
    "--team-ink-subtle": palette.inkSubtle,
    "--team-accent": palette.accent,
    "--team-accent-strong": palette.accentStrong,
    "--team-accent-soft": palette.accentSoft,
    "--team-muted": palette.muted,
    "--team-border": palette.border,
    "--team-border-strong": palette.borderStrong,
    "--team-contrast": palette.contrast,
    "--team-steel": palette.steel,
  } as CSSProperties;
}
