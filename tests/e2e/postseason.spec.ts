import { expect, test } from "@playwright/test";
import { enabledTeamSlugs } from "../../src/config/team";

test("every edition has a Postseason view, reachable by link, keyboard and the Brief", async ({ page }) => {
  for (const slug of enabledTeamSlugs) {
    await page.goto(`/teams/${slug}#postseason`);
    await expect(page.getByRole("tab", { name: "Postseason" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { level: 1, name: "Postseason" })).toBeVisible();
    await expect(page.getByTestId("postseason-view")).toContainText(/(Playoff|Bowl) race/);
  }

  await page.goto("/teams/texas-football#schedule");
  const schedule = page.getByRole("tab", { name: "Schedule" });
  await schedule.focus();
  await schedule.press("ArrowRight");
  await expect(page).toHaveURL(/#postseason$/);

  await page.goto("/teams/utah-state-football");
  await page.getByRole("button", { name: /Bracket, rankings and dates/ }).click();
  await expect(page).toHaveURL(/#postseason$/);
  await expect(page.getByRole("tab", { name: "Postseason" })).toBeFocused();
});

test("the bowl ladder and bracket are described in text, not drawn alone", async ({ page }) => {
  await page.goto("/teams/utah-state-football#postseason");
  await expect(page.getByRole("img", { name: /counted wins?, bowl eligible at 6, up to \d+ still possible/ })).toBeVisible();
  for (const round of ["First round", "Quarterfinals", "Semifinals", "National championship"]) {
    await expect(page.getByRole("heading", { level: 3, name: new RegExp(round) })).toBeVisible();
  }
  // Sources are links out, never bare text.
  await expect(page.getByRole("link", { name: /NCAA\.com: How the College Football Playoff works/ })).toHaveAttribute("href", /^https:\/\/www\.ncaa\.com\//);
});

// The bracket is a drawn tree only where four rounds fit; below that it is a
// reading sequence. Assert both shapes so a breakpoint change cannot silently
// squeeze the tree into a phone.
test("the bracket draws as a tree on desktop and stacks on a phone", async ({ page }) => {
  const rounds = page.locator('[data-testid="postseason-view"] section[data-round]');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/teams/texas-football#postseason");
  await expect(rounds).toHaveCount(4);
  const wide = await rounds.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
  expect(new Set(wide).size, "rounds side by side").toBe(1);
  await page.setViewportSize({ width: 375, height: 900 });
  const narrow = await rounds.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)));
  expect(new Set(narrow).size, "rounds stacked").toBe(4);
});

for (const theme of ["light", "dark"] as const) {
  test(`the Postseason view never scrolls sideways (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("section-one-theme", value), theme);
    for (const width of [320, 375, 768, 1023, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const slug of ["texas-football", "utah-state-football"]) {
        await page.goto(`/teams/${slug}#postseason`);
        await expect(page.locator("main")).toHaveAttribute("data-theme", theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${slug} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });
}
