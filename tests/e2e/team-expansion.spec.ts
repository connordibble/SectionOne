import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`new editions preserve school colors and conference navigation in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("section-one-theme", value), theme);
    for (const team of [
      { slug: "ohio-state-football", name: "Ohio State", color: [186, 12, 47], opponent: "Texas", broadcast: "ABC" },
      { slug: "lsu-football", name: "LSU", color: [70, 29, 124], opponent: "Louisiana Tech", broadcast: "SEC Network+" },
    ]) {
      await page.goto(`/teams/${team.slug}`);
      const switcher = page.getByLabel("Team", { exact: true });
      await expect(switcher).toHaveValue(team.slug);
      await expect(switcher.locator("optgroup")).toHaveCount(3);
      await expect(switcher.locator('optgroup[label="Big Ten"] option')).toHaveText(["Ohio State"]);
      await expect(switcher.locator('optgroup[label="Pac-12"] option')).toHaveText(["Utah State"]);
      await expect(switcher.locator('optgroup[label="SEC"] option')).toHaveText(["LSU", "Texas"]);
      // The UA paints optgroup labels black unless we give them the chrome ink.
      const groupColor = await switcher.locator("optgroup").first().evaluate((node) => getComputedStyle(node).color);
      const optionColor = await switcher.locator("option:not(:checked)").first().evaluate((node) => getComputedStyle(node).color);
      expect(groupColor).toBe(optionColor);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/teams/${team.slug}$`));
      const lead = page.getByTestId("kickoff-lead");
      await expect(lead).toContainText(team.opponent);
      await expect(lead).toContainText(team.broadcast);
      const rgb = await lead.evaluate((node) => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.fillStyle = getComputedStyle(node).getPropertyValue("--team-stage").trim();
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      });
      rgb.forEach((value, index) => expect(Math.abs(value - team.color[index])).toBeLessThanOrEqual(2));
      await page.getByRole("tab", { name: "Schedule", exact: true }).click();
      await expect(page.getByRole("tabpanel")).toContainText("Sep 12");
      await switcher.selectOption(team.slug === "ohio-state-football" ? "lsu-football" : "ohio-state-football");
      await expect(page).toHaveURL(new RegExp(`/teams/${team.slug === "ohio-state-football" ? "lsu-football" : "ohio-state-football"}$`));
    }
  });
}
