import { formatSite, getNextGame, getTeamSchedule } from "@/server/schedule/schedule";

type SchedulePreviewProps = {
  teamSlug: string;
};

export function SchedulePreview({ teamSlug }: SchedulePreviewProps) {
  const schedule = getTeamSchedule(teamSlug);

  if (!schedule) {
    return null;
  }

  const nextGame = getNextGame(teamSlug);

  return (
    <section className="py-6 md:py-8" data-testid="schedule-strip">
      <h2 className="text-[length:var(--text-xl)] font-semibold leading-tight tracking-tight">
        {schedule.seasonYear} schedule
      </h2>

      {/* A chronological table, not a card grid. Chronology is the only thing a
          schedule exists to convey, and a grid destroys it — the eye reads
          across before it reads down, so week three lands beside week one. A
          fixture list is also what every sports page has looked like for a
          century; matching it costs the reader nothing to learn. */}
      <ol className="mt-3">
        {schedule.games.map((game) => {
          const isNext = game.id === nextGame?.id;

          return (
            <li
              // Every row is inset by the same amount and carries the same
              // left rule; only its colour changes. Applying the inset just to
              // the marked row would push its date out of the column and break
              // the alignment a fixture table exists to provide.
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-t border-l-2 border-[var(--team-border)] py-2.5 pl-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] ${
                isNext ? "border-l-[var(--team-accent)]" : "border-l-transparent"
              }`}
              key={game.id}
            >
              <span
                className={`tnum order-2 text-[length:var(--text-xs)] leading-5 sm:order-none sm:text-[length:var(--text-sm)] ${
                  isNext
                    ? "font-semibold text-[var(--team-accent-strong)]"
                    : "text-[var(--team-muted)]"
                }`}
              >
                {game.dateLabel.replace(/^\w+day,\s*/, "")}
              </span>

              <span className="order-1 min-w-0 text-[length:var(--text-md)] font-medium leading-6 sm:order-none">
                <span className="text-[var(--team-muted)]">{formatSite(game.site)} </span>
                <span className="text-[var(--team-ink)]">{game.opponent}</span>
                {isNext ? (
                  <span className="ml-2 align-middle text-[length:var(--text-2xs)] font-semibold uppercase tracking-wide text-[var(--team-accent-strong)]">
                    Next
                  </span>
                ) : null}
              </span>

              <span className="tnum order-3 whitespace-nowrap text-right text-[length:var(--text-xs)] leading-5 text-[var(--team-muted)] sm:order-none sm:text-[length:var(--text-sm)]">
                {game.kickoff}
                <span className="hidden text-[var(--team-border-strong)] sm:inline"> · </span>
                <span className="block sm:inline">{game.tv ?? "TV TBD"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
