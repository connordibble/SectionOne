import { expect, test } from "@playwright/test";
import { enabledTeamSlugs } from "../../src/config/team";

test("the playoff page renders its own head and every edition's postseason card", async ({ page }) => {
  await page.goto("/playoff");
  await expect(page).toHaveTitle("The playoff race · Section One");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/playoff$/);
  await expect(page.getByRole("heading", { level: 1, name: "The playoff race" })).toBeVisible();
  for (const slug of enabledTeamSlugs) {
    await expect(page.locator(`#teams a[href="/teams/${slug}#postseason"]`)).toHaveText(/(Playoff|Bowl) race/i);
  }
  // Sources are links out, never bare text.
  await expect(page.getByRole("link", { name: /NCAA\.com: How the College Football Playoff works/ })).toHaveAttribute("href", /^https:\/\/www\.ncaa\.com\//);
});

test("an edition's postseason section links to the playoff page and back", async ({ page }) => {
  await page.goto("/teams/utah-state-football");
  const section = page.locator("#postseason");
  await expect(section.getByRole("heading", { name: "Postseason" })).toBeVisible();
  await expect(section).toContainText(/Bowl race|Playoff race/);
  await section.getByRole("link", { name: "See the full playoff race" }).click();
  await expect(page).toHaveURL(/\/playoff$/);
  await page.locator('#teams a[href="/teams/utah-state-football#postseason"]').click();
  await expect(page).toHaveURL(/\/teams\/utah-state-football#postseason$/);
  await expect(page.locator("#postseason")).toBeInViewport();
});

// The failure this project keeps shipping is a layout that is right at most
// widths and wrong at a few. Sweep the boundaries in both themes.
for (const theme of ["light", "dark"] as const) {
  test(`postseason surfaces never scroll sideways (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => window.localStorage.setItem("section-one-theme", value), theme);
    for (const width of [320, 375, 768, 959, 960, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/playoff", "/teams/texas-football"]) {
        await page.goto(path);
        await expect(page.locator("main")).toHaveAttribute("data-theme", theme);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
      }
    }
  });
}
