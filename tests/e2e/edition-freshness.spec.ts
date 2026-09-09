import { expect, test } from "@playwright/test";

test("an aging briefing points to official game details in every view", async ({ page }) => {
  await page.clock.install({ time: new Date("2099-01-01T12:00:00Z") });
  await page.goto("/teams/texas-football");
  const notice = page.getByRole("complementary", { name: "Briefing freshness" });
  await expect(notice).toContainText("needs a fresh review");
  await expect(notice.getByRole("link")).toHaveAttribute("href", /^https:\/\/texaslonghorns.com\//);
  await page.getByRole("tab", { name: "Matchup", exact: true }).click();
  await expect(notice).toBeVisible();
  await page.getByRole("tab", { name: "Schedule", exact: true }).click();
  await expect(notice).toBeVisible();
});
