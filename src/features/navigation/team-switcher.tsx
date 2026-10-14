"use client";

import { type PointerEvent } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./team-switcher.module.css";

export type TeamOption = { slug: string; shortName: string; conference: string };

function isTouchLikePointer(event: PointerEvent<HTMLSelectElement>): boolean {
  if (event.pointerType === "touch" || event.pointerType === "pen") {
    return true;
  }

  if (event.pointerType === "mouse") {
    return false;
  }

  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

// Tapping an already-open styled picker does not close it, because the picker
// is in the top layer and the tap lands on the trigger rather than outside it.
// Native pickers and desktop mouse clicks already close on their own, so this
// only fills the touch gap and leaves every other path untouched.
function closeOpenSelectOnTriggerTap(event: PointerEvent<HTMLSelectElement>) {
  const select = event.currentTarget;

  if (event.target !== select || !isTouchLikePointer(event)) {
    return;
  }

  try {
    if (select.matches(":open")) {
      event.preventDefault();
      select.blur();
    }
  } catch {
    // Browsers without :open support keep their native picker behaviour.
  }
}

export function TeamSwitcher({ teamOptions, value = "" }: { teamOptions: TeamOption[]; value?: string }) {
  return (
    <span className={styles.selectField}>
      <select
        aria-label="Team"
        className={styles.teamSwitcher}
        onChange={(event) => {
          const selected = event.currentTarget.value;
          if (selected && selected !== value) window.location.assign(`/teams/${selected}`);
        }}
        onPointerDown={closeOpenSelectOnTriggerTap}
        value={value}
      >
        {!value ? <option disabled value="">Choose team</option> : null}
        {[...new Set(teamOptions.map((option) => option.conference))].sort().map((conference) => (
          <optgroup key={conference} label={conference}>
            {teamOptions.filter((option) => option.conference === conference)
              .sort((a, b) => a.shortName.localeCompare(b.shortName, "en"))
              .map((option) => <option key={option.slug} value={option.slug}>{option.shortName}</option>)}
          </optgroup>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className={styles.selectChevron} />
    </span>
  );
}
