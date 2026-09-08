import { expect, test } from "@playwright/test";
import current from "../../data/editions/current.json";

// These are publication assertions, separate from frozen unit-test behavior.
// Compare every displayed claim/link with the accepted interchange artifact.
for (const edition of Object.values(current)) {
  for (const theme of ["light", "dark"] as const) {
    test(`${edition.teamSlug}: accepted package renders in ${theme}`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("section-one-theme", value), theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`/teams/${edition.teamSlug}`);
      await expect(page.locator("main[data-theme]")).toHaveAttribute("data-theme", theme);
      const news = page.locator('[aria-labelledby="news-heading"]');
      await expect(news.locator("li")).toHaveCount(edition.items.length);
      for (const item of edition.items) {
        const row = news.locator("li").filter({ hasText: item.headline });
        await expect(row.getByText(item.headline, { exact: true })).toBeVisible();
        await expect(row.getByText(item.tldr, { exact: true })).toBeVisible();
        await expect(row.locator("a")).toHaveAttribute("href", item.url);
        await expect(row).toContainText(item.outlet);
      }
      await expect(page.getByText(edition.editorial.lead.body, { exact: true })).toBeVisible();
      await expect(page.getByText(edition.summary, { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}
