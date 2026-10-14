"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { TeamSwitcher, type TeamOption } from "@/features/navigation/team-switcher";
import { Wordmark } from "@/features/brand/wordmark";
import styles from "./home.module.css";

type ThemeMode = "light" | "dark";

const themeLabels: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
};

type HomeShellProps = {
  children: ReactNode;
  // Passed in rather than read from config: this is a client component, and
  // importing the team config here would pull every edition's schedule and
  // notes fixture into the browser bundle to produce navigation options.
  teamOptions: TeamOption[];
  themeStyle: CSSProperties;
};

// Owns the same light/dark contract as the team workspace, including the
// storage key, so a fan who picks dark on an edition page does not get flashed
// back to light when they land on the home page.
export function HomeShell({ children, teamOptions, themeStyle }: HomeShellProps) {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const savedTheme = window.localStorage.getItem("section-one-theme");

      if (savedTheme === "light" || savedTheme === "dark") {
        setThemeMode(savedTheme);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function cycleTheme() {
    const nextTheme = themeMode === "light" ? "dark" : "light";
    setThemeMode(nextTheme);
    window.localStorage.setItem("section-one-theme", nextTheme);
  }

  return (
    <main className={`team-theme ${styles.shell}`} data-theme={themeMode} style={themeStyle}>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>

      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.brandBlock}>
            <Wordmark />
          </div>

          <nav aria-label="Home sections" className={styles.nav}>
            <a href="#what-you-get">What you get</a>
            <a href="#editions">Editions</a>
            <a href="#request">Request a team</a>
          </nav>

          <div className={styles.headerControls}>
            <TeamSwitcher teamOptions={teamOptions} />
            <button
              aria-label={`Color theme: ${themeLabels[themeMode]}. Change theme.`}
              className={styles.themeToggle}
              onClick={cycleTheme}
              title={`Theme: ${themeLabels[themeMode]}`}
              type="button"
            >
              {themeMode === "light" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{themeLabels[themeMode]}</span>
            </button>
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
