import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  createThemeStyle,
  defaultTeamConfig,
  deriveTeamPalettes,
  enabledTeamSlugs,
  getTeamConfig,
  houseTheme,
  type TeamConfig,
} from "@/config/team";
import {
  formatCaptureDate,
  getKickoffCountdown,
  getNextGame,
  getTeamSchedule,
  type KickoffCountdown,
} from "@/server/schedule/schedule";
import { SectionMark } from "@/features/brand/section-mark";
import { HomeField } from "./home-field";
import { HomeShell } from "./home-shell";
import { RequestForm } from "./request-form";
import styles from "./home.module.css";

// The three questions are the product's spine, not marketing invention — they
// are the same three the design system holds every element to.
const questions = [
  {
    title: "What matters this week",
    body: "Three things to know before kickoff, in plain English. Not a preview essay, not a stat dump.",
  },
  {
    title: "What to watch during the game",
    body: "The handful of things that actually decide it, with what a good or bad version looks like.",
  },
  {
    title: "What backs that up",
    body: "Every read names where it came from and the date it was checked. You can go look yourself.",
  },
];

const differences = [
  {
    title: "Sources, every time",
    body: "Answers name what they came from. If the sources do not cover it, the page says so instead of guessing.",
  },
  {
    title: "No rumor mill",
    body: "No injury speculation, no betting talk, no claims of inside information. Not on a slow week, and not when everyone else is running it.",
  },
  {
    // "By fans", not "like a fan": the claim is about who decides what matters
    // that week, which is the part a general assistant cannot say. It stays
    // true only while a person who watches the games writes the reads a fan
    // sees — if that ever changes, this line has to change with it.
    title: "Written by fans",
    body: "Someone who actually watches the games picks what matters. Early downs, field position, who wins up front — not press-release language.",
  },
];

export function Home() {
  const editions = enabledTeamSlugs.flatMap((slug) => {
    const team = getTeamConfig(slug);

    return team ? [team] : [];
  });

  // The edition a cold visitor lands in when they click through without picking
  // one. It is the default team rather than a hardcoded route, so the home page
  // keeps working when the roster of editions changes.
  const featuredEdition = `/teams/${defaultTeamConfig.slug}`;

  return (
    <HomeShell
      editionHref={featuredEdition}
      themeStyle={createThemeStyle(houseTheme) as CSSProperties}
    >
      <div className={styles.page} id="main" tabIndex={-1}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroHeadline}>
              {/* The explicit space is for the accessible name: JSX drops
                  whitespace between elements, so without it a screen reader
                  announces "Your team.Your section." The block spans collapse
                  it visually. */}
              <span>Your team.</span>{" "}
              <span>Your section.</span>
            </h1>
            <p className={styles.heroBody}>
              A short, sourced read on your team every game week. What to watch, why it matters, and
              where the answer came from.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryAction} href="#request">
                Request your team
                <ArrowRight aria-hidden="true" />
              </a>
              <Link className={styles.secondaryAction} href={featuredEdition}>
                See a live edition
              </Link>
            </div>
          </div>

          <HomeField />
        </section>

        <section aria-labelledby="what-you-get-heading" className={styles.band} id="what-you-get">
          <h2 className={styles.sectionHeading} id="what-you-get-heading">
            Every page answers three questions
          </h2>
          <ol className={styles.questionList}>
            {questions.map((question, index) => (
              <li key={question.title}>
                <span className={`${styles.questionNumber} tnum`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{question.title}</h3>
                  <p>{question.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="editions-heading" className={styles.band} id="editions">
          <div className={styles.sectionHeadingRow}>
            <h2 className={styles.sectionHeading} id="editions-heading">
              Editions
            </h2>
            {/* Honest scale. One edition is one edition; dressing it up as a
                network would be the first thing a fan caught us on. */}
            <p className={styles.sectionAside}>
              {editions.length === 1
                ? "One edition live. More coming from the request list."
                : `${editions.length} editions live. More coming from the request list.`}
            </p>
          </div>

          <div className={styles.editionGrid}>
            {editions.map((team) => (
              <EditionCard key={team.slug} team={team} />
            ))}
            <div className={styles.editionPlaceholder}>
              <p className={styles.editionPlaceholderTitle}>Your team here</p>
              <p>
                New editions come off the request list. Tell us who you follow and it counts.
              </p>
              <a className={styles.inlineAction} href="#request">
                Request your team
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section aria-labelledby="difference-heading" className={styles.band}>
          <h2 className={styles.sectionHeading} id="difference-heading">
            Why it reads differently
          </h2>
          <div className={styles.differenceGrid}>
            {differences.map((difference) => (
              <article key={difference.title}>
                <h3>{difference.title}</h3>
                <p>{difference.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="request-heading" className={styles.requestBand} id="request">
          <div className={styles.requestCopy}>
            <h2 className={styles.requestHeading} id="request-heading">
              Most teams do not get covered like this
            </h2>
            <p>
              The biggest programs have four beat writers, a podcast, and a message board. Everyone
              else gets a box score. Section One covers a Sun Belt or MAC team the same way it
              covers an SEC team.
            </p>
            <p className={styles.requestSubtle}>
              Tell us who you follow. The teams fans ask for most are the ones we cover next.
            </p>
          </div>
          <RequestForm />
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <SectionMark className={styles.footerMark} />
          <p>
            <strong>Section One</strong> · Independent coverage. Not affiliated with any school,
            conference, or athletics department.
          </p>
          <p className={styles.footerEditions}>
            {editions.map((team) => (
              <Link href={`/teams/${team.slug}`} key={team.slug}>
                {team.shortName} edition
              </Link>
            ))}
          </p>
        </div>
      </footer>
    </HomeShell>
  );
}

// Real data from the live edition, not a picture of one. The countdown, the
// matchup, and the lead all come from the same config and schedule the edition
// page renders, so this card cannot drift out of sync with the product.
function EditionCard({ team }: { team: TeamConfig }) {
  const nextGame = getNextGame(team.slug);
  const schedule = getTeamSchedule(team.slug);
  const countdown = getKickoffCountdown(nextGame);
  const palettes = deriveTeamPalettes(team.theme);

  // The card carries a hairline of its own edition's colour. The page itself
  // stays house — an edition's hue taking over the home page is exactly what
  // the surface rules forbid — but a sample bounded to the card is the fastest
  // honest way to show that an edition is coloured for its team.
  const editionAccent = {
    "--edition-light-accent": palettes.light.accent,
    "--edition-dark-accent": palettes.dark.accent,
    // The countdown is the loudest thing on the card, so it carries the
    // edition's text-weight accent rather than the house one. Both modes are
    // emitted because the bridge cannot compute them at render time.
    "--edition-light-accent-strong": palettes.light.accentStrong,
    "--edition-dark-accent-strong": palettes.dark.accentStrong,
  } as CSSProperties;

  return (
    <Link className={styles.editionCard} href={`/teams/${team.slug}`} style={editionAccent}>
      <span className={styles.editionKicker}>{team.conference}</span>
      <span className={styles.editionName}>{team.displayName}</span>

      <span className={styles.editionFigure}>
        <CountdownLabel countdown={countdown} />
      </span>

      {nextGame ? (
        <span className={`${styles.editionMatchup} tnum`}>
          {team.shortName} {nextGame.site === "away" ? "at" : "vs"} {nextGame.opponent} ·{" "}
          {nextGame.kickoff}
        </span>
      ) : null}

      <span className={styles.editionLead}>{team.editorial.lead.headline}</span>

      {schedule ? (
        <span className={styles.editionChecked}>
          Schedule updated {formatCaptureDate(schedule.capturedAt)}
        </span>
      ) : null}

      <span className={styles.editionOpen}>
        Open edition
        <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}

function CountdownLabel({ countdown }: { countdown: KickoffCountdown }) {
  if (countdown.state === "today") {
    return <>Today</>;
  }

  if (countdown.state === "unscheduled") {
    return <>Kickoff TBD</>;
  }

  return (
    <>
      <span className="tnum">{countdown.days}</span> {countdown.days === 1 ? "day out" : "days out"}
    </>
  );
}
