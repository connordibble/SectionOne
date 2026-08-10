import { expect, test } from "@playwright/test";

// The split hero is the layout most likely to break quietly, because the panel
// carries its own margin and padding inside a sized track. When the split
// arrived too early those insets ate the track and the countdown clipped out of
// the panel — with no error and nothing to notice unless you were at that exact
// width. The regression that caused it was subtler still: a pre-redesign rule
// split the grid from 40rem up, and the redesign block never declared the
// property, so the legacy value governed every width below the real breakpoint.
//
// This sweeps the supported range and asserts the contract directly.
const SPLIT_AT = 86 * 16;

const widths = [
  320, 375, 414, 600, 768, 900, 1024, 1200, 1280, 1366, SPLIT_AT - 1, SPLIT_AT, 1440, 1536, 1600,
  1792, 1920, 2560,
];

test("the brief hero stacks until the panel can hold its contents", async ({ page }) => {
  const problems: string[] = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/teams/texas-football");

    const report = await page.evaluate(() => {
      const lead = document.querySelector("[data-testid=kickoff-lead]") as HTMLElement;
      const panel = document.querySelector("[data-testid=game-field-object]") as HTMLElement;
      const footer = panel.querySelector("[class*=fieldObjectFooter]") as HTMLElement;

      return {
        stacked: getComputedStyle(lead).gridTemplateColumns.trim().split(/\s+/).length === 1,
        panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
        footerOverflow: footer.scrollWidth > footer.clientWidth + 1,
        pageScrollsSideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    if (report.stacked !== width < SPLIT_AT) {
      problems.push(`${width}px: stacked=${report.stacked}, expected ${width < SPLIT_AT}`);
    }
    if (report.panelOverflow) {
      problems.push(`${width}px: kickoff panel clips its own contents`);
    }
    if (report.footerOverflow) {
      problems.push(`${width}px: kickoff panel footer clips`);
    }
    if (report.pageScrollsSideways) {
      problems.push(`${width}px: page scrolls horizontally`);
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});

// Every carded surface draws all four of its own edges, at every width.
//
// Three separate rules had each been zeroing a single side: two left over from
// when these were ruled sections rather than cards, and one I added to strip
// the old column dividers before the card treatment existed. A card missing one
// edge is invisible in review and obvious on screen, and it only showed up at
// the widths where that rule applied — so it gets asserted rather than eyeballed.
const CARDS = [
  "[class*=readSection]",
  "[class*=scheduleCompact] [class*=scheduleRow]",
  "[class*=promptList] button",
];

test("carded surfaces keep all four edges at every width", async ({ page }) => {
  const problems: string[] = [];

  for (const width of [390, 768, 900, 1280, 1440, 1800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/teams/utah-state-football");

    for (const selector of CARDS) {
      const edges = await page.evaluate(
        (s) =>
          [...document.querySelectorAll(s)].map((el) => {
            const c = getComputedStyle(el);
            return [
              c.borderTopWidth,
              c.borderRightWidth,
              c.borderBottomWidth,
              c.borderLeftWidth,
            ].join("/");
          }),
        selector,
      );

      edges.forEach((edge, index) => {
        if (edge !== "1px/1px/1px/1px") {
          problems.push(`${width}px ${selector}[${index}] = ${edge}`);
        }
      });
    }
  }

  expect(problems, problems.join("\n")).toEqual([]);
});
