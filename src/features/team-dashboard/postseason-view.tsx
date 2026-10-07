import type { CSSProperties } from "react";
import { FinalScore } from "./final-score";
import { daysUntil } from "@/lib/postseason/calendar";
import type { BracketGame, BracketRound, BracketSlot } from "@/lib/postseason/bracket";
import {
  bowlLine, formatEventDate, leadFigure, pathLine, playoffLine, rankingStatusLine, recordDetail,
} from "@/lib/postseason/copy";
import { contentionLossLimit, type BowlOutlook } from "@/lib/postseason/outlook";
import type { CommitteeRow, PostseasonView as PostseasonViewData } from "@/lib/postseason/view";
import { formatNewsDate } from "@/lib/news-date";
import { safeExternalHref } from "@/lib/safe-url";
import styles from "./team-workspace.module.css";

const numberWords = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const list = (items: readonly string[]) =>
  items.length < 3 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const dateRange = (dates: readonly string[]) =>
  dates.length > 1 ? `${formatEventDate(dates[0])} – ${formatEventDate(dates.at(-1)!)}` : dates[0] ? formatEventDate(dates[0]) : "";

// The fourth view. One team-coloured board answers "where do we stand and
// what is next"; everything under it is reference, read from the team outward:
// the committee's ranking with this team and its opponents marked, the real
// bracket, the rules, and the calendar. Nothing here is a forecast.
export function PostseasonView({ view, teamName }: { view: PostseasonViewData; teamName: string }) {
  return (
    <section className={styles.postseasonView} data-testid="postseason-view">
      <div className={styles.signalHeading}>
        <div>
          <p className={styles.signalKicker}>04 / The race</p>
          <h1>Postseason</h1>
          <p>Where {teamName} stands in the playoff and bowl races, and the dates that decide them.</p>
        </div>
        <p className={styles.boardInstruction}>Rules checked {formatNewsDate(view.checkedAt)}</p>
      </div>

      <RaceBoard teamName={teamName} view={view} />
      <Standing teamName={teamName} view={view} />
      <Committee teamName={teamName} view={view} />
      <Bracket fieldSet={view.outlook.playoff.phase === "field-set"} rounds={view.bracket} selectionDay={view.rules.selectionDay} sourceUrl={view.outlook.playoff.fieldSourceUrl} teamName={teamName} />
      <Rules view={view} />
    </section>
  );
}

function RaceBoard({ view, teamName }: { view: PostseasonViewData; teamName: string }) {
  const { outlook, nextMilestone, today } = view;
  const lead = leadFigure(outlook);
  const days = nextMilestone ? daysUntil(nextMilestone.date, today) : undefined;
  const clockLabel = nextMilestone && days !== undefined
    ? `Next: ${nextMilestone.label}, ${formatEventDate(nextMilestone.date)}, ${days === 0 ? "today" : `${days} ${days === 1 ? "day" : "days"} out`}`
    : undefined;
  return (
    <div className={styles.raceBoard} data-lead={outlook.lead}>
      <div className={styles.raceStanding}>
        <p className={styles.raceLabel}>{outlook.lead === "bowl" ? "Bowl race" : "Playoff race"} · {teamName}</p>
        <p className={styles.raceFigure}>
          <span className="tnum">{lead.figure}</span>
          {lead.unit ? <span className={styles.raceUnit}>{lead.unit}</span> : null}
        </p>
        <p className={styles.raceContext}>{lead.context}</p>
      </div>
      {nextMilestone && days !== undefined ? (
        <div aria-label={clockLabel} className={styles.raceClock} role="group">
          <p className={styles.raceClockLabel}>Next up</p>
          <p className={styles.raceClockFigure} aria-hidden="true">
            {days === 0 ? "Today" : <><span className="tnum">{days}</span><span>{days === 1 ? "day" : "days"}</span></>}
          </p>
          <p className={styles.raceClockName} aria-hidden="true">{nextMilestone.label}</p>
          <p className={`${styles.raceClockDate} tnum`} aria-hidden="true">{formatEventDate(nextMilestone.date)}</p>
        </div>
      ) : null}
      {outlook.bowl.state !== "unknown" ? <BowlLadder bowl={outlook.bowl} rungs={view.bowlRules.regularSeasonGames} /> : null}
    </div>
  );
}

type RungState = "won" | "unconfirmed" | "open" | "out";

// Read from counted wins, not from the selection: a team picked under the
// 5-7 exception is bowl bound without ever reaching the line.
function ladderStatus(bowl: BowlOutlook): string {
  if (bowl.countedWins >= bowl.winsRequired) return "Reached";
  if (bowl.state === "selected") return "Picked below the line";
  if (bowl.state === "out") return "Out of reach";
  return `${numberWords[bowl.winsNeeded] ?? bowl.winsNeeded} to go`;
}

// The bowl line as a ladder: one rung per possible win. Counted wins fill,
// wins that are still possible stay open, and the rest are out of reach. The
// rule sits at the line itself, so "four wins to go" is something a fan sees
// rather than computes.
function BowlLadder({ bowl, rungs }: { bowl: BowlOutlook; rungs: number }) {
  const states: RungState[] = Array.from({ length: rungs }, (_, index) => {
    const rung = index + 1;
    if (rung <= bowl.countedWins) return "won";
    if (rung <= bowl.countedWins + bowl.unclassifiedWins) return "unconfirmed";
    if (rung <= bowl.reachableWins) return "open";
    return "out";
  });
  const required = bowl.winsRequired;
  const summary = [
    `${bowl.countedWins} counted ${bowl.countedWins === 1 ? "win" : "wins"}`,
    bowl.unclassifiedWins ? `${bowl.unclassifiedWins} not yet confirmed to count` : null,
    `bowl eligible at ${required}`,
    `up to ${bowl.reachableWins} still possible`,
  ].filter(Boolean).join(", ");
  return (
    <figure className={styles.bowlLadder} style={{ "--rungs": rungs } as CSSProperties}>
      <figcaption className={styles.bowlLadderCaption}>
        <span>The bowl line</span>
        <span>{ladderStatus(bowl)}</span>
      </figcaption>
      <div aria-label={`${summary}.`} className={styles.ladderTrack} role="img">
        <span aria-hidden="true" className={styles.ladderLineLabel} style={{ gridColumn: `1 / span ${required}` }}>
          Bowl eligible
        </span>
        {states.map((state, index) => (
          <span aria-hidden="true" className={styles.ladderRung} data-line={index + 1 === required ? "true" : undefined} data-state={state} key={index}>
            <span className="tnum">{index + 1}</span>
          </span>
        ))}
      </div>
      <ul aria-hidden="true" className={styles.ladderKey}>
        <li data-state="won">Counted</li>
        {bowl.unclassifiedWins ? <li data-state="unconfirmed">Not yet confirmed</li> : null}
        <li data-state="open">Still possible</li>
        {states.includes("out") ? <li data-state="out">Out of reach</li> : null}
      </ul>
    </figure>
  );
}

function Standing({ view, teamName }: { view: PostseasonViewData; teamName: string }) {
  const { outlook } = view;
  const { playoff, bowl, record } = outlook;
  const rows = [
    { label: "Record", value: recordDetail(record) },
    { label: "Playoff", value: playoffLine(playoff, record) },
    { label: "Path", value: pathLine(playoff) },
    { label: "Bowl", value: bowlLine(bowl) },
  ].filter((row) => row.label !== (outlook.lead === "bowl" ? "Bowl" : "Playoff")
    && !(row.label === "Path" && playoff.phase === "field-set"));
  const behind = rankingStatusLine(playoff);
  const rankingHref = playoff.ranking ? safeExternalHref(playoff.ranking.sourceUrl) : undefined;
  const fieldHref = playoff.fieldSourceUrl ? safeExternalHref(playoff.fieldSourceUrl) : undefined;
  const selectionHref = bowl.selection ? safeExternalHref(bowl.selection.sourceUrl) : undefined;
  return (
    <section aria-labelledby="postseason-standing-heading" className={styles.raceSection}>
      <div className={styles.raceSectionHeading}>
        <p className={styles.sectionFolio}>Standing</p>
        <h2 id="postseason-standing-heading">Where {teamName} stands</h2>
      </div>
      <dl className={styles.postseasonFacts}>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.rankingNote}>
        {playoff.phase === "before-rankings"
          ? `“In the picture” means ranked in the AP poll or no more than ${numberWords[contentionLossLimit]} losses. It is a reading of the record, not a forecast. `
          : null}
        {behind ? `${behind} ` : null}
        {playoff.phase === "rankings" && playoff.ranking && rankingHref ? <>
          <a href={rankingHref} rel="noreferrer" target="_blank">Committee ranking {formatNewsDate(playoff.ranking.releasedAt)}</a>.{" "}
        </> : null}
        {fieldHref && playoff.fieldAnnouncedAt ? <><a href={fieldHref} rel="noreferrer" target="_blank">Field announced {formatNewsDate(playoff.fieldAnnouncedAt)}</a>. </> : null}
        {selectionHref && bowl.selection ? <><a href={selectionHref} rel="noreferrer" target="_blank">Bowl announced {formatNewsDate(bowl.selection.announcedAt)}</a>. </> : null}
        Record from {teamName} results checked {formatNewsDate(outlook.scheduleCheckedAt)}.
      </p>
    </section>
  );
}

function OpponentTag({ row }: { row: CommitteeRow }) {
  if (row.isTeam) return <span className={styles.committeeTag} data-kind="team">This edition</span>;
  if (!row.opponent) return null;
  const { status, result } = row.opponent;
  return (
    <span className={styles.committeeTag} data-kind="opponent">
      {status === "final"
        ? <>Played{result ? <> · <FinalScore className={styles.committeeTagScore} result={result} /></> : null}</>
        : "On the schedule"}
    </span>
  );
}

function CommitteeGroup({ rows, from, to, label, note }: { rows: CommitteeRow[]; from: number; to: number; label: string; note: string }) {
  const group = rows.filter((row) => row.rank >= from && row.rank <= to);
  if (!group.length) return null;
  const id = `committee-group-${from}`;
  return (
    <div className={styles.committeeGroup}>
      <h3 className={styles.rankingGroupHeading} id={id}>{label}<span>{note}</span></h3>
      <ol aria-labelledby={id} className={styles.committeeList}>
        {group.map((row) => (
          <li data-team={row.isTeam ? "true" : undefined} data-opponent={row.opponent ? "true" : undefined} key={row.rank}>
            <span className={`${styles.committeeRank} tnum`}>{row.rank}</span>
            <span className={styles.committeeTeam}>
              {row.team}
              <OpponentTag row={row} />
            </span>
            <span className={`${styles.committeeRecord} tnum`}>{row.record}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Committee({ view, teamName }: { view: PostseasonViewData; teamName: string }) {
  const { committee, rules } = view;
  const behind = rankingStatusLine(view.outlook.playoff);
  const href = committee ? safeExternalHref(committee.sourceUrl) : undefined;
  return (
    <section aria-labelledby="postseason-committee-heading" className={styles.raceSection}>
      <div className={styles.raceSectionHeading}>
        <p className={styles.sectionFolio}>Committee</p>
        <h2 id="postseason-committee-heading">The top 25</h2>
        <p className={styles.sectionAside}>
          {committee ? `${committee.weekLabel} · ${formatNewsDate(committee.releasedAt)}` : rules.firstRelease ? `First release ${formatEventDate(rules.firstRelease)}` : "Not released"}
        </p>
      </div>
      {behind && committee ? <p className={styles.raceNotice}>{behind} The last verified release is below.</p> : null}
      {committee ? (
        <>
          <div className={styles.committeeColumns}>
            <div>
              <CommitteeGroup from={1} label={`Top ${rules.byes}`} note="Bye line" rows={committee.ranks} to={rules.byes} />
              <CommitteeGroup from={rules.byes + 1} label={`${rules.byes + 1} to ${rules.fieldSize}`} note={`Inside the top ${rules.fieldSize}`} rows={committee.ranks} to={rules.fieldSize} />
            </div>
            <div>
              <CommitteeGroup from={rules.fieldSize + 1} label={`${rules.fieldSize + 1} to 25`} note={`Outside the top ${rules.fieldSize}`} rows={committee.ranks} to={25} />
            </div>
          </div>
          <p className={styles.rankingNote}>
            A rank is not a seed. The {list(rules.championBids)} champions are in whatever their ranking, and so is the
            highest-ranked {rules.groupBid.label} team, so a team inside the top {rules.fieldSize} can still miss.{" "}
            Teams on the {teamName} schedule are marked.{" "}
            {href ? <a href={href} rel="noreferrer" target="_blank">Ranking checked {formatNewsDate(committee.capturedAt)}</a> : null}.
          </p>
        </>
      ) : (
        <p className={styles.raceEmpty}>
          {behind ?? `Nothing to rank yet. The committee's first top 25 comes out ${rules.firstRelease ? formatEventDate(rules.firstRelease) : "in November"}.`}{" "}
          It appears here once it is out and checked, with {teamName} and every ranked team on its schedule marked. Media polls are
          not the committee, so this view does not stand one in for it.
        </p>
      )}
    </section>
  );
}

function slotName(slot: BracketSlot): string {
  if (slot.team) return slot.team;
  if (slot.seed) return `Seed ${slot.seed}`;
  if (slot.from && slot.from.length <= 3) return `Winner ${slot.from.join("/")}`;
  return "Semifinal winner";
}

function SlotView({ slot }: { slot: BracketSlot }) {
  return (
    <span className={styles.bracketSlot} data-team={slot.isTeam ? "true" : undefined} data-pending={slot.seed ? undefined : "true"}>
      <span aria-hidden="true" className={`${styles.bracketSeed} tnum`}>{slot.seed ?? "W"}</span>
      <span className={styles.bracketName}>
        {slot.seed && slot.team ? <span className={styles.visuallyHidden}>No. {slot.seed} </span> : null}
        {slotName(slot)}
      </span>
    </span>
  );
}

function GameView({ game, host }: { game: BracketGame; host?: number }) {
  return (
    <li className={styles.bracketGame} data-road={game.onRoad ? "true" : undefined}>
      <SlotView slot={game.slots[0]} />
      <SlotView slot={game.slots[1]} />
      {host ? <span className={styles.bracketHost}>At No. {host}&apos;s home</span> : null}
    </li>
  );
}

// The published bracket. Before Selection Day it is the format drawn out, seed
// numbers only; after it, the announced teams fill the slots and the edition's
// team's road is traced. Bowl sites are named per round rather than per game,
// because the top seeds pick their quarterfinal sites on Selection Day.
function Bracket({ rounds, selectionDay, fieldSet, sourceUrl, teamName }: {
  rounds: BracketRound[]; selectionDay: string; fieldSet: boolean; sourceUrl?: string; teamName: string;
}) {
  const href = sourceUrl ? safeExternalHref(sourceUrl) : undefined;
  return (
    <section aria-labelledby="postseason-bracket-heading" className={styles.raceSection}>
      <div className={styles.raceSectionHeading}>
        <p className={styles.sectionFolio}>Bracket</p>
        <h2 id="postseason-bracket-heading">The bracket</h2>
        <p className={styles.sectionAside}>{fieldSet ? "As announced" : `Seeds set ${formatEventDate(selectionDay)}`}</p>
      </div>
      <div className={styles.bracket} data-filled={fieldSet ? "true" : undefined}>
        {rounds.map((round, roundIndex) => {
          const id = `bracket-round-${roundIndex}`;
          const pairs = roundIndex === 1 || roundIndex === 2;
          const games = pairs
            ? Array.from({ length: Math.ceil(round.games.length / 2) }, (_, index) => round.games.slice(index * 2, index * 2 + 2))
            : round.games.map((game) => [game]);
          return (
            <section aria-labelledby={id} className={styles.bracketRound} data-round={roundIndex} key={round.name}>
              <h3 className={styles.bracketRoundHeading} id={id}>
                {round.name}
                <span className="tnum">{dateRange(round.dates)}</span>
                <span>{round.sites.join(", ")}</span>
              </h3>
              <ol className={styles.bracketGames}>
                {games.map((group) => group.length > 1 ? (
                  <li className={styles.bracketPair} key={group[0].id}>
                    <ol>
                      {group.map((game) => <GameView game={game} key={game.id} />)}
                    </ol>
                  </li>
                ) : (
                  <GameView game={group[0]} host={roundIndex === 0 ? group[0].slots[0].seed : undefined} key={group[0].id} />
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      <p className={styles.rankingNote}>
        {fieldSet
          ? <>{rounds.some((round) => round.games.some((game) => game.onRoad))
              ? `Highlighted: the games ${teamName} plays in or would reach by winning. `
              : `${teamName} is not in the field. `}There is no re-seeding.{href ? <> <a href={href} rel="noreferrer" target="_blank">Official bracket</a>.</> : null}</>
          : `The top four seeds wait for the first-round winners; there is no re-seeding. Teams fill these slots on Selection Day, and the top seeds then pick their bowl sites.`}
      </p>
    </section>
  );
}

function Rules({ view }: { view: PostseasonViewData }) {
  const { rules, bowlRules, timeline, sources } = view;
  const steps = [
    { title: "Four champions", body: `The ${list(rules.championBids)} champions are in, whatever their ranking.` },
    { title: `One ${rules.groupBid.label} team`, body: `The highest-ranked team from the ${list(rules.groupBid.conferences)}, champion or not.` },
    ...rules.independentBids.map((bid) => ({ title: bid.team, body: `In automatically with a top-${bid.withinRank} finish.` })),
    { title: "At-large picks", body: `The rest of the ${rules.fieldSize} come from the committee's final ranking.` },
    { title: "Seeding", body: `By final ranking. The top ${rules.byes} get a bye; the next ${(rules.fieldSize - rules.byes) / 2} host first-round games.` },
  ];
  const cite = (ids: readonly string[]) => sources.filter((source) => ids.includes(source.id));
  return (
    <section aria-labelledby="postseason-rules-heading" className={`${styles.raceSection} ${styles.raceRules}`}>
      <div className={styles.raceRulesColumn}>
        <div className={styles.raceSectionHeading}>
          <p className={styles.sectionFolio}>Rules</p>
          <h2 id="postseason-rules-heading">How teams get in</h2>
        </div>
        <ol className={styles.raceSteps}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className={`${styles.raceStepNumber} tnum`}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className={styles.raceSubheading}>The bowl line</h3>
        <p className={styles.raceProse}>
          {capitalize(numberWords[bowlRules.winsRequired] ?? String(bowlRules.winsRequired))} wins make a team bowl eligible, and only{" "}
          {numberWords[bowlRules.maxCountedFcsWins] ?? bowlRules.maxCountedFcsWins} can come against an FCS team. If bowls run
          short, a conference can fill a spot with a {bowlRules.alternates.wins}-{bowlRules.alternates.losses} team whose
          academic progress rate is at least {bowlRules.alternates.minimumApr}. Eligible is not invited: a destination shows here
          only once it is announced.
        </p>
        <p className={styles.rankingNote}>
          Sources:{" "}
          {cite([...rules.sourceIds, ...bowlRules.sourceIds]).map((source, index) => {
            const href = safeExternalHref(source.url);
            return (
              <span key={source.id}>
                {index ? "; " : ""}
                {href ? <a href={href} rel="noreferrer" target="_blank">{source.label}</a> : source.label}
              </span>
            );
          })}
          .
        </p>
      </div>
      <div className={styles.raceRulesColumn}>
        <div className={styles.raceSectionHeading}>
          <p className={styles.sectionFolio}>Calendar</p>
          <h2 id="postseason-dates-heading">Dates</h2>
        </div>
        <ol aria-labelledby="postseason-dates-heading" className={styles.timeline}>
          {timeline.map((entry) => (
            <li data-kind={entry.kind} data-state={entry.state} key={entry.id}>
              <span aria-hidden="true" className={styles.timelineMark} />
              <span className={`${styles.timelineDate} tnum`}>
                {dateRange(entry.dates)}
                {entry.state === "now" ? <strong> · Now</strong> : entry.state === "next" ? <strong> · Next</strong> : null}
              </span>
              <span className={styles.timelineLabel}>{entry.label}</span>
              <span className={styles.timelineDetail}>{entry.detail}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
