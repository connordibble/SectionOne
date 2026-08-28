import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import {
  deriveTeamPalettes,
  enabledTeamSlugs,
  getTeamConfig,
  houseTheme,
  type TeamPalette,
} from "../src/config/team";
import { formatSite, getNextGame } from "../src/server/schedule/schedule";

// Social cards are committed build artifacts so crawlers never wait on a
// runtime image render. Re-run `pnpm og:build` whenever weekly editorial copy,
// the next game, or the palette changes.
const width = 1200;
const height = 630;

type Card = {
  palette: TeamPalette;
  kicker: string;
  headline: string;
  subhead: string;
  detail: string;
  home?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cardHtml(card: Card): string {
  const { palette } = card;
  const headlineSize = card.home ? 112 : card.headline.length <= 22 ? 80 : 68;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Geist:wght@400;500;650&display=swap"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: ${palette.steel};
        color: ${palette.onSteel};
        font-family: "Geist", sans-serif;
      }
      .card {
        position: relative;
        display: grid;
        grid-template-rows: auto 1fr auto;
        width: 100%;
        height: 100%;
        padding: 54px 64px 48px;
      }
      .stage {
        position: absolute;
        inset: 0 0 0 auto;
        width: ${card.home ? "34%" : "42%"};
        background: ${card.home ? palette.steelRaised : palette.stage};
      }
      .field {
        position: absolute;
        inset: 0 0 0 auto;
        width: ${card.home ? "34%" : "42%"};
        opacity: 0.28;
      }
      .yard, .cross {
        position: absolute;
        background: ${palette.graphic};
      }
      .yard { inset-block: 0; width: 2px; }
      .yard:nth-child(1) { left: 18%; }
      .yard:nth-child(2) { left: 40%; }
      .yard:nth-child(3) { left: 62%; }
      .yard:nth-child(4) { left: 84%; }
      .cross { inset-inline: 0; height: 2px; }
      .cross:nth-child(5) { top: 24%; }
      .cross:nth-child(6) { top: 50%; }
      .cross:nth-child(7) { top: 76%; }
      .header, .main, .footer { position: relative; z-index: 1; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; }
      .wordmark {
        font-family: "Big Shoulders Display", sans-serif;
        font-weight: 800;
        font-size: 46px;
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .wordmark span { color: ${palette.accentSoft}; }
      .tagline {
        margin-top: 9px;
        font-family: "Big Shoulders Display", sans-serif;
        font-weight: 700;
        font-size: 18px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .issue {
        max-width: 420px;
        color: ${card.home ? palette.onSteel : palette.onStage};
        font-size: 17px;
        font-weight: 650;
        letter-spacing: 0.14em;
        text-align: right;
        text-transform: uppercase;
      }
      .main { align-self: center; max-width: ${card.home ? "820px" : "600px"}; }
      .kicker {
        margin-bottom: 18px;
        color: ${palette.accentSoft};
        font-size: 17px;
        font-weight: 650;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .headline {
        font-family: "Big Shoulders Display", sans-serif;
        font-size: ${headlineSize}px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: 0.005em;
        text-transform: uppercase;
      }
      .subhead {
        max-width: 720px;
        margin-top: 22px;
        color: ${palette.onSteel};
        font-size: 24px;
        line-height: 1.35;
        opacity: 0.82;
      }
      .footer {
        display: flex;
        gap: 48px;
        align-items: flex-end;
        justify-content: space-between;
        border-top: 2px solid ${palette.accentSoft};
        padding-top: 18px;
      }
      .detail { font-size: 18px; letter-spacing: 0.03em; opacity: 0.78; }
      .domain { font-size: 16px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.64; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="stage"></div>
      <div class="field" aria-hidden="true">
        <span class="yard"></span><span class="yard"></span><span class="yard"></span><span class="yard"></span>
        <span class="cross"></span><span class="cross"></span><span class="cross"></span>
      </div>
      <header class="header">
        <div>
          <div class="wordmark">Section <span>One</span></div>
          <div class="tagline">All signal. No noise.</div>
        </div>
        <div class="issue">Saturday edition<br />Independent</div>
      </header>
      <main class="main">
        <div class="kicker">${escapeHtml(card.kicker)}</div>
        <div class="headline">${escapeHtml(card.headline)}</div>
        <div class="subhead">${escapeHtml(card.subhead)}</div>
      </main>
      <footer class="footer">
        <div class="detail">${escapeHtml(card.detail)}</div>
        <div class="domain">sectiononesports.com</div>
      </footer>
    </div>
  </body>
</html>`;
}

async function capture(page: Page, card: Card, file: string) {
  await page.setContent(cardHtml(card), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await writeFile(file, await page.screenshot({ type: "png" }));
  console.log(`Wrote ${width}x${height} to ${path.relative(process.cwd(), file)}`);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const socialDir = path.join(process.cwd(), "public", "social");

  await mkdir(socialDir, { recursive: true });

  await capture(
    page,
    {
      palette: deriveTeamPalettes(houseTheme).light,
      kicker: "College football · Independent",
      headline: "Your team. Your section.",
      subhead: "A short, sourced read on your team every game week.",
      detail: "What to watch · Why it matters · Where the answer came from",
      home: true,
    },
    path.join(process.cwd(), "src", "app", "opengraph-image.png"),
  );

  for (const slug of enabledTeamSlugs) {
    const team = getTeamConfig(slug)!;
    const nextGame = getNextGame(slug);
    const matchup = nextGame
      ? `${team.shortName} ${formatSite(nextGame.site)} ${nextGame.opponent}`
      : team.displayName;
    const detail = nextGame
      ? [nextGame.dateLabel, nextGame.kickoff, nextGame.tv].filter(Boolean).join(" · ")
      : team.referenceLabel;

    await capture(
      page,
      {
        palette: deriveTeamPalettes(team.theme).light,
        kicker: team.referenceLabel,
        headline: matchup,
        subhead: team.editorial.lead.headline,
        detail,
      },
      path.join(socialDir, `${slug}.png`),
    );
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
