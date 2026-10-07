import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { createThemeStyle, defaultTeamConfig, deriveTeamPalettes, houseTheme, type TeamConfig } from "@/config/team";
import { SectionMark } from "@/features/brand/section-mark";
import { HomeShell } from "@/features/home/home-shell";
import homeStyles from "@/features/home/home.module.css";
import { matchesAnyName } from "@/lib/facts/team-names";
import { formatNewsDate } from "@/lib/news-date";
import type { CommitteeRanking } from "@/lib/postseason/committee";
import { formatEventDate, leadFigure, recordDetail } from "@/lib/postseason/copy";
import { firstRoundPairs, type TeamPostseason } from "@/lib/postseason/outlook";
import type { PostseasonSeason } from "@/lib/postseason/season";
import { safeExternalHref } from "@/lib/safe-url";
import type { PlayoffTracker } from "@/server/postseason/postseason";
import styles from "./playoff.module.css";

const nav = [
  { href: "#teams", label: "Our teams" },
  { href: "#committee", label: "Committee" },
  { href: "#format", label: "How teams get in" },
  { href: "#dates", label: "Dates" },
];

const dayMs = 86_400_000;
const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const list = (items: readonly string[]) =>
  items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

// One page for the national race. It does not forecast: before the committee
// ranks anyone it says when it will, and after Selection Day the bracket it
// shows is the announced one. Each edition keeps its own detailed read.
export function Playoff({ tracker }: { tracker?: PlayoffTracker }) {
  return (
    <HomeShell
      editionHref={`/teams/${defaultTeamConfig.slug}`}
      nav={nav}
      navLabel="Playoff sections"
      themeStyle={createThemeStyle(houseTheme) as CSSProperties}
    >
      <div className={homeStyles.page} id="main" tabIndex={-1}>
        {tracker ? <TrackerBody tracker={tracker} /> : (
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heading}>The playoff race</h1>
              <p className={styles.heroBody}>This season&apos;s playoff rules have not been posted here yet.</p>
            </div>
          </section>
        )}
      </div>
      <footer className={homeStyles.footer}>
        <div className={homeStyles.footerInner}>
          <SectionMark className={homeStyles.footerMark} />
          <p>
            <strong>Section One</strong> · Independent coverage. Not affiliated with the College Football
            Playoff, any conference, or any school.
          </p>
          <p className={homeStyles.footerEditions}>
            {tracker?.editions.map(({ team }) => (
              <Link href={`/teams/${team.slug}`} key={team.slug}>{team.shortName} edition</Link>
            ))}
          </p>
        </div>
      </footer>
    </HomeShell>
  );
}

function TrackerBody({ tracker }: { tracker: PlayoffTracker }) {
  const { season, committee, nextMilestone, today } = tracker;
  const field = season.confirmed.playoffField;
  const days = nextMilestone ? Math.round((Date.parse(nextMilestone.date) - Date.parse(today)) / dayMs) : undefined;
  const standfirst = field
    ? `The ${season.playoff.fieldSize}-team field is set. Here is the bracket as announced, and where each Section One team landed.`
    : committee
      ? `The committee's latest top 25 is out. Here is where it puts each Section One team, and what the rest of the season decides.`
      : `${capitalize(words[season.playoff.fieldSize] ?? String(season.playoff.fieldSize))} teams, picked by a committee. Its first top 25 comes out ${formatEventDate(season.playoff.rankings[0].date)}. Until then, here is where each Section One team stands.`;

  return (
    <>
      <section aria-labelledby="playoff-heading" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{season.season} season · Rules checked {formatNewsDate(season.checkedAt)}</p>
          <h1 className={styles.heading} id="playoff-heading">The playoff race</h1>
          <p className={styles.heroBody}>{standfirst}</p>
        </div>
        {nextMilestone && days !== undefined ? (
          <div aria-label={`Next: ${nextMilestone.label}, ${days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} out`}`} className={styles.milestone} role="group">
            <p className={styles.milestoneLabel}>Next up</p>
            <p className={styles.milestoneFigure}>
              {days === 0 ? "Today" : <><span className="tnum">{days}</span><span>{days === 1 ? "day" : "days"}</span></>}
            </p>
            <p className={styles.milestoneName}>{nextMilestone.label}</p>
            <p className={`${styles.milestoneDate} tnum`}>{formatEventDate(nextMilestone.date)}</p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="teams-heading" className={homeStyles.band} id="teams">
        <div className={homeStyles.sectionHeadingRow}>
          <h2 className={homeStyles.sectionHeading} id="teams-heading">Our teams</h2>
          <p className={homeStyles.sectionAside}>The bowl race leads once a team is out of the picture.</p>
        </div>
        <div className={homeStyles.editionGrid}>
          {tracker.editions.map(({ team, outlook }) => <TeamCard key={team.slug} outlook={outlook} team={team} />)}
        </div>
      </section>

      <section aria-labelledby="committee-heading" className={homeStyles.band} id="committee">
        {field ? <Field season={season} tracker={tracker} /> : <Committee tracker={tracker} />}
      </section>

      <Format season={season} />
      <Dates season={season} today={today} />
    </>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function TeamCard({ team, outlook }: { team: TeamConfig; outlook: TeamPostseason }) {
  const palettes = deriveTeamPalettes(team.theme);
  const accent = {
    "--edition-light-accent": palettes.light.accent,
    "--edition-dark-accent": palettes.dark.accent,
    "--edition-light-accent-strong": palettes.light.accentStrong,
    "--edition-dark-accent-strong": palettes.dark.accentStrong,
  } as CSSProperties;
  const lead = leadFigure(outlook);
  return (
    <Link className={homeStyles.editionCard} href={`/teams/${team.slug}#postseason`} style={accent}>
      <span className={homeStyles.editionKicker}>{team.conference}</span>
      <span className={homeStyles.editionName}>{team.displayName}</span>
      <span className={styles.cardLabel}>{outlook.lead === "bowl" ? "Bowl race" : "Playoff race"}</span>
      <span className={homeStyles.editionFigure}>
        <span className="tnum">{lead.figure}</span>{lead.unit ? ` ${lead.unit}` : ""}
      </span>
      <span className={homeStyles.editionLead}>{lead.context}</span>
      <span className={homeStyles.editionChecked}>{recordDetail(outlook.record)}</span>
      <span className={homeStyles.editionOpen}>
        Open edition
        <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}

function editionFor(tracker: PlayoffTracker, name: string) {
  return tracker.editions.find(({ team }) => matchesAnyName([team.shortName, team.displayName, ...team.aliases], name))?.team;
}

function Committee({ tracker }: { tracker: PlayoffTracker }) {
  const { committee, season, rankingBehind } = tracker;
  const { fieldSize, byes } = season.playoff;
  const href = committee ? safeExternalHref(committee.sourceUrl) : undefined;
  return (
    <>
      <div className={homeStyles.sectionHeadingRow}>
        <h2 className={homeStyles.sectionHeading} id="committee-heading">The committee&apos;s top 25</h2>
        <p className={homeStyles.sectionAside}>
          {committee ? `${committee.weekLabel} · Released ${formatNewsDate(committee.releasedAt)}` : `First release ${formatEventDate(season.playoff.rankings[0].date)}`}
        </p>
      </div>
      {rankingBehind ? (
        <p className={styles.notice}>The {formatEventDate(rankingBehind.date)} rankings have not been checked yet{committee ? "; the last verified release is below" : ""}.</p>
      ) : null}
      {committee ? (
        <>
          {/* Two columns on wide screens: the top 12, then the rest. A single
              full-width list strands each record a page-width from its team. */}
          <div className={styles.rankColumns}>
            <div>
              <RankGroup committee={committee} from={1} to={byes} label={`Top ${byes}`} note="First-round bye line" tracker={tracker} />
              <RankGroup committee={committee} from={byes + 1} to={fieldSize} label={`${byes + 1} to ${fieldSize}`} note={`Inside the top ${fieldSize}`} tracker={tracker} />
            </div>
            <div>
              <RankGroup committee={committee} from={fieldSize + 1} to={25} label={`${fieldSize + 1} to 25`} note={`Outside the top ${fieldSize}`} tracker={tracker} />
            </div>
          </div>
          <p className={styles.note}>
            A rank is not a seed. The {list(season.playoff.championBids)} champions are in whatever their ranking, and so
            is the highest-ranked {season.playoff.groupBid.label} team, so a team ranked inside the top {fieldSize} can
            still be left out.{" "}
            {href ? <a href={href} rel="noreferrer" target="_blank">Ranking checked {formatNewsDate(committee.capturedAt)}</a> : null}.
          </p>
        </>
      ) : (
        <p className={styles.empty}>
          Nothing to rank yet. The committee&apos;s first top 25 comes out {formatEventDate(season.playoff.rankings[0].date)}, and it
          appears here once two published versions of it agree. Media polls are not the committee, so this page does not
          stand one in for it.
        </p>
      )}
    </>
  );
}

function RankGroup({ committee, from, to, label, note, tracker }: {
  committee: CommitteeRanking; from: number; to: number; label: string; note: string; tracker: PlayoffTracker;
}) {
  const rows = committee.ranks.filter((row) => row.rank >= from && row.rank <= to);
  if (!rows.length) return null;
  const id = `committee-${from}`;
  return (
    <div className={styles.rankGroup}>
      <h3 className={styles.rankGroupHeading} id={id}>{label}<span>{note}</span></h3>
      <ol className={styles.rankList} aria-labelledby={id}>
        {rows.map((row) => {
          const edition = editionFor(tracker, row.team);
          return (
            <li key={row.rank} data-edition={edition ? "true" : undefined}>
              <span className={`${styles.rank} tnum`}>{row.rank}</span>
              <span className={styles.rankTeam}>
                {edition ? <Link href={`/teams/${edition.slug}#postseason`}>{row.team}</Link> : row.team}
              </span>
              <span className={`${styles.rankRecord} tnum`}>{row.record}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Field({ season, tracker }: { season: PostseasonSeason; tracker: PlayoffTracker }) {
  const field = season.confirmed.playoffField!;
  const ordered = [...field.seeds].sort((a, b) => a.seed - b.seed);
  const href = safeExternalHref(field.sourceUrl);
  const name = (team: string) => {
    const edition = editionFor(tracker, team);
    return edition ? <Link href={`/teams/${edition.slug}#postseason`}>{team}</Link> : team;
  };
  return (
    <>
      <div className={homeStyles.sectionHeadingRow}>
        <h2 className={homeStyles.sectionHeading} id="committee-heading">The field</h2>
        <p className={homeStyles.sectionAside}>Announced {formatNewsDate(field.announcedAt)}</p>
      </div>
      <div className={styles.rankGroup}>
        <h3 className={styles.rankGroupHeading} id="field-byes">First-round byes</h3>
        <ol className={styles.rankList} aria-labelledby="field-byes">
          {ordered.slice(0, season.playoff.byes).map((seed) => (
            <li key={seed.seed}>
              <span className={`${styles.rank} tnum`}>{seed.seed}</span>
              <span className={styles.rankTeam}>{name(seed.team)}</span>
              <span className={styles.rankRecord}>{seed.bid === "automatic" ? "Automatic" : "At-large"}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.rankGroup}>
        <h3 className={styles.rankGroupHeading} id="field-first-round">First round</h3>
        <ol className={styles.rankList} aria-labelledby="field-first-round">
          {firstRoundPairs(ordered, season.playoff.byes).map(({ higher, lower }) => (
            <li key={higher.seed}>
              <span className={`${styles.rank} tnum`}>{higher.seed}</span>
              <span className={styles.rankTeam}>{name(higher.team)} hosts No. {lower.seed} {name(lower.team)}</span>
            </li>
          ))}
        </ol>
      </div>
      {href ? <p className={styles.note}><a href={href} rel="noreferrer" target="_blank">Official bracket</a>.</p> : null}
    </>
  );
}

function SourceLinks({ season, ids }: { season: PostseasonSeason; ids: string[] }) {
  const sources = season.sources.filter((source) => ids.includes(source.id));
  return (
    <p className={styles.note}>
      Sources:{" "}
      {sources.map((source, index) => {
        const href = safeExternalHref(source.url);
        return (
          <span key={source.id}>
            {index ? "; " : ""}
            {href ? <a href={href} rel="noreferrer" target="_blank">{source.label}</a> : source.label}
          </span>
        );
      })}
      . Checked {formatNewsDate(season.checkedAt)}.
    </p>
  );
}

function Format({ season }: { season: PostseasonSeason }) {
  const { playoff, bowls } = season;
  const rules = [
    { title: "Four champions", body: `The ${list(playoff.championBids)} champions are in, whatever their ranking.` },
    { title: `One ${playoff.groupBid.label} team`, body: `The highest-ranked team from the ${list(playoff.groupBid.conferences)}, champion or not.` },
    ...playoff.independentBids.map((bid) => ({ title: bid.team, body: `${bid.team} is in automatically if it finishes in the top ${bid.withinRank}.` })),
    { title: "At-large picks", body: `The rest of the ${playoff.fieldSize} come from the committee's final ranking.` },
    { title: "Seeding", body: `Seeds follow the final ranking. The top ${playoff.byes} get a first-round bye; the next ${(playoff.fieldSize - playoff.byes) / 2} host first-round games.` },
  ];
  return (
    <section aria-labelledby="format-heading" className={homeStyles.band} id="format">
      <h2 className={homeStyles.sectionHeading} id="format-heading">How teams get in</h2>
      <ol className={styles.ruleList}>
        {rules.map((rule, index) => (
          <li key={rule.title}>
            <span className={`${styles.ruleNumber} tnum`}>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{rule.title}</h3>
              <p>{rule.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <SourceLinks ids={playoff.sourceIds} season={season} />
      <h3 className={styles.subheading}>If the playoff is out of reach</h3>
      <p className={styles.prose}>
        A team needs {words[bowls.winsRequired] ?? bowls.winsRequired} wins to be bowl eligible, and only {words[bowls.maxCountedFcsWins] ?? bowls.maxCountedFcsWins} of
        them can come against an FCS team. If bowls run short of eligible teams, a conference can fill a spot
        with a {bowls.alternates.wins}-{bowls.alternates.losses} team that has an academic progress rate of at least {bowls.alternates.minimumApr}.
        Eligible is not invited: bowls are filled on Selection Day weekend, and a confirmed pick shows on the team&apos;s edition.
      </p>
      <SourceLinks ids={bowls.sourceIds} season={season} />
    </section>
  );
}

function Dates({ season, today }: { season: PostseasonSeason; today: string }) {
  const rows = [
    ...season.playoff.rankings.map((release) => ({ dates: [release.date], label: release.label, detail: release.date === season.playoff.selectionDay ? "Final ranking and the field" : "Committee top 25" })),
    ...season.playoff.rounds.map((round) => ({ dates: round.dates, label: round.name, detail: list(round.sites) })),
  ];
  return (
    <section aria-labelledby="dates-heading" className={homeStyles.band} id="dates">
      <h2 className={homeStyles.sectionHeading} id="dates-heading">Dates</h2>
      <ol className={styles.dateList}>
        {rows.map((row) => {
          const past = row.dates.at(-1)! < today;
          return (
            <li data-past={past ? "true" : undefined} key={`${row.label}-${row.dates[0]}`}>
              <span className={`${styles.dateValue} tnum`}>
                {row.dates.map(formatEventDate).join(" – ")}
              </span>
              <span className={styles.dateLabel}>{row.label}</span>
              <span className={styles.dateDetail}>{row.detail}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
