import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { deriveTeamPalettes, houseTheme } from "../src/config/team";

// Renders the social card at exactly the size the platforms crop to.
//
// Generated rather than drawn, and generated from `houseTheme` rather than
// from hand-picked hex values, so the card cannot drift away from the palette
// the site actually ships. Re-run it after any change to the house anchors:
//
//   pnpm og:build
//
// The output is committed because a social crawler should not wait on a render,
// and because Next needs a real file to read the dimensions from.
const width = 1200;
const height = 630;

const palette = deriveTeamPalettes(houseTheme).light;

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Geist:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: ${width}px;
        height: ${height}px;
        background: ${palette.steel};
        color: ${palette.onSteel};
        font-family: "Geist", sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 68px 72px 60px;
      }
      .wordmark {
        font-family: "Big Shoulders Display", sans-serif;
        font-weight: 800;
        font-size: 46px;
        line-height: 1;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      /* The accent sits on one word, as it does in the masthead. Roughly three
         percent of the canvas — it points, it does not flood. */
      .wordmark span { color: ${palette.accentSoft}; }
      .tagline {
        margin-top: 10px;
        font-family: "Big Shoulders Display", sans-serif;
        font-weight: 700;
        font-size: 19px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .rule {
        height: 2px;
        background: ${palette.accentSoft};
        margin: 34px 0 0;
      }
      .headline {
        font-family: "Big Shoulders Display", sans-serif;
        font-weight: 800;
        font-size: 116px;
        line-height: 0.96;
        letter-spacing: 0.005em;
        text-transform: uppercase;
      }
      .footer {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 48px;
      }
      .blurb {
        max-width: 620px;
        font-size: 25px;
        line-height: 1.45;
        opacity: 0.82;
      }
      .domain {
        font-family: ui-monospace, "SF Mono", monospace;
        font-size: 18px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.6;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div>
      <div class="wordmark">Section <span>One</span></div>
      <div class="tagline">All signal. No noise.</div>
      <div class="rule"></div>
    </div>

    <div class="headline">Your team.<br />Your section.</div>

    <div class="footer">
      <div class="blurb">
        A short, sourced read on your team every game week. What to watch, why it matters, and
        where the answer came from.
      </div>
      <div class="domain">College football</div>
    </div>
  </body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

  await page.setContent(html, { waitUntil: "networkidle" });
  // Screenshotting before the webfonts land would silently ship a fallback
  // face, which is the one thing a brand card cannot get wrong.
  await page.evaluate(() => document.fonts.ready);

  const buffer = await page.screenshot({ type: "png" });
  await browser.close();

  const file = path.join(process.cwd(), "src", "app", "opengraph-image.png");
  await writeFile(file, buffer);

  console.log(`Wrote ${width}x${height} to ${path.relative(process.cwd(), file)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
