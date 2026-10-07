import type { ScheduleGame } from "@/lib/facts/schedule";
import styles from "./team-workspace.module.css";

export function FinalScore({ result, className }: {
  result: NonNullable<ScheduleGame["result"]>;
  className: string;
}) {
  const { teamScore, opponentScore } = result;
  const outcome = teamScore > opponentScore ? "Win" : teamScore < opponentScore ? "Loss" : "Tie";
  return (
    <span className={`${className} tnum`}>
      <span aria-hidden="true">{outcome[0]} </span>
      <span className={styles.visuallyHidden}>{outcome}: </span>
      {teamScore}–{opponentScore}
    </span>
  );
}
