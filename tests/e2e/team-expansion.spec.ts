import { expect, test } from "@playwright/test";
import { enabledTeamSlugs, getTeamConfig } from "../../src/config/team";
import { getNextGame } from "../../src/server/schedule/schedule";
const teams = enabledTeamSlugs.map((slug) => getTeamConfig(slug)!);
const colorAnchors: Record<string, number[]> = { "ohio-state-football": [186, 12, 47], "lsu-football": [70, 29, 124] };

for (const theme of ["light", "dark"] as const) {
  test(`new editions preserve school colors and conference navigation in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("section-one-theme", value), theme);
    for (const team of teams) {
      await page.goto(`/teams/${team.slug}`);
      const switcher = page.getByLabel("Team", { exact: true });
      await expect(switcher).toHaveValue(team.slug);
      const conferences = [...new Set(teams.map((team) => team.conference))].sort();
      await expect(switcher.locator("optgroup")).toHaveCount(conferences.length);
      for (const conference of conferences) {
        const members = teams.filter((team) => team.conference === conference).map((team) => team.shortName).sort();
        await expect(switcher.locator(`optgroup[label="${conference}"] option`)).toHaveText(members);
      }
      // The UA paints optgroup labels black unless we give them the chrome ink.
      const groupColor = await switcher.locator("optgroup").first().evaluate((node) => getComputedStyle(node).color);
      const optionColor = await switcher.locator("option:not(:checked)").first().evaluate((node) => getComputedStyle(node).color);
      expect(groupColor).toBe(optionColor);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/teams/${team.slug}$`));
      const lead = page.getByTestId("kickoff-lead");
      const next = getNextGame(team.slug);
      if (next) {
        await expect(lead).toContainText(next.opponent);
        if (next.tv) await expect(lead).toContainText(next.tv);
      }
      const rgb = await lead.evaluate((node) => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.fillStyle = getComputedStyle(node).getPropertyValue("--team-stage").trim();
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      });
      if (colorAnchors[team.slug]) rgb.forEach((value, index) => expect(Math.abs(value - colorAnchors[team.slug][index])).toBeLessThanOrEqual(2));
      await page.getByRole("tab", { name: "Schedule", exact: true }).click();
      if (next) await expect(page.getByRole("tabpanel")).toContainText(next.opponent);
      const other = teams.find((candidate) => candidate.slug !== team.slug);
      if (other) {
        await switcher.selectOption(other.slug);
        await expect(page).toHaveURL(new RegExp(`/teams/${other.slug}$`));
      }
    }
  });
}
