import { expect, test } from "@playwright/test";
import { enabledTeamSlugs } from "../../src/config/team";

for (const slug of enabledTeamSlugs) {
  test(`${slug} never shows the disabled briefing age banner`, async ({ page }) => {
    await page.clock.install({ time: new Date("2099-01-01T12:00:00Z") });
    await page.goto(`/teams/${slug}`);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") await page.getByRole("button", { name: /Color theme:/ }).click();
      for (const view of ["Brief", "Matchup", "Schedule"]) {
        await page.getByRole("tab", { name: view, exact: true }).click();
        await expect(page.getByRole("complementary", { name: "Briefing freshness" })).toHaveCount(0);
        await expect(page.getByText("needs a fresh review", { exact: false })).toHaveCount(0);
      }
    }
    await page.clock.fastForward(120_000);
    await expect(page.getByRole("complementary", { name: "Briefing freshness" })).toHaveCount(0);
  });
}
