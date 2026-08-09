import { ArrowRight } from "lucide-react";
import type { ScheduleGame, TeamSchedule } from "@/server/schedule/schedule";
import styles from "./team-workspace.module.css";

type SchedulePreviewProps = {
  nextGameId?: string;
  onOpenSchedule?: () => void;
  schedule?: TeamSchedule;
  variant: "compact" | "full";
};

export function SchedulePreview({
  nextGameId,
  onOpenSchedule,
  schedule,
  variant,
}: SchedulePreviewProps) {
  if (!schedule) {
    return (
      <section className={styles.scheduleEmpty} data-testid="schedule-strip">
        <h2>Schedule</h2>
        <p>No dates have been posted for this team yet.</p>
      </section>
    );
  }

  const nextIndex = Math.max(
    0,
    schedule.games.findIndex((game) => game.id === nextGameId),
  );
  const games =
    variant === "compact" ? schedule.games.slice(nextIndex, nextIndex + 3) : schedule.games;

  return (
    <section
      className={variant === "compact" ? styles.scheduleCompact : styles.scheduleFull}
      data-testid="schedule-strip"
    >
      <div className={styles.scheduleHeading}>
        <div>
          <h2>{variant === "compact" ? "Next three" : `${schedule.seasonYear} schedule`}</h2>
          {variant === "full" ? (
            <p>{schedule.games.length} games. Dates and TV can change.</p>
          ) : null}
        </div>
        {variant === "compact" && onOpenSchedule ? (
          <button className={styles.scheduleLink} onClick={onOpenSchedule} type="button">
            Full schedule
            <ArrowRight aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <ol className={styles.scheduleList}>
        {games.map((game) => (
          <ScheduleRow
            game={game}
            isNext={game.id === nextGameId}
            key={game.id}
            variant={variant}
          />
        ))}
      </ol>
    </section>
  );
}

function ScheduleRow({
  game,
  isNext,
  variant,
}: {
  game: ScheduleGame;
  isNext: boolean;
  variant: "compact" | "full";
}) {
  return (
    <li className={styles.scheduleRow} data-next={isNext || undefined}>
      <time className={`${styles.scheduleDate} tnum`} dateTime={game.startsAt ?? undefined}>
        {shortDate(game.dateLabel)}
      </time>
      <div className={styles.scheduleOpponent}>
        <p>
          <span>{siteWord(game.site)} </span>
          <strong>{game.opponent}</strong>
          {isNext ? <span className={styles.nextGameLabel}>Next</span> : null}
        </p>
        {variant === "full" ? <span>{game.venue}</span> : null}
      </div>
      <p className={`${styles.scheduleKickoff} tnum`}>
        <span>{game.kickoff}</span>
        <span>{game.tv ?? "TV TBD"}</span>
      </p>
    </li>
  );
}

function siteWord(site: ScheduleGame["site"]): string {
  return site === "away" ? "at" : "vs";
}

function shortDate(dateLabel: string): string {
  return dateLabel.replace(/^\w+day,\s*/, "");
}
