import { expect, test } from "@playwright/test";

test("leads with the fan promise and two ways in", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /your team\. your section\./i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Section One home" })).toBeVisible();
  await expect(page.getByText("All signal. No noise.")).toBeVisible();
  await expect(page.getByRole("link", { name: /see a live edition/i }).first()).toHaveAttribute(
    "href",
    "/teams/texas-football",
  );
});

test("skip links move focus into the page content", async ({ page }) => {
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await skipLink.focus();
  await skipLink.press("Enter");

  await expect(page.locator("#main")).toBeFocused();
});

test("a team edition also exposes a working skip link", async ({ page }) => {
  await page.goto("/teams/texas-football");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await skipLink.focus();
  await skipLink.press("Enter");

  await expect(page.locator("#workspace-panel")).toBeFocused();
});

test("the edition card carries real schedule data and opens the edition", async ({ page }) => {
  await page.goto("/");

  const edition = page.getByRole("link", { name: /texas football/i });
  // Same config and schedule the edition page renders — a card that can drift
  // out of sync with the product would be advertising, not proof.
  await expect(edition).toContainText(/\d+\s*days? out|Today|Kickoff TBD/);
  await expect(edition).toContainText(/Schedule updated/);

  await edition.click();
  await expect(page).toHaveURL(/\/teams\/texas-football$/);
  await expect(page.getByTestId("kickoff-lead")).toBeVisible();
});

test("states the honest number of live editions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/2 editions live/i)).toBeVisible();
  await expect(page.locator('#editions a[href^="/teams/"]')).toHaveCount(2);
});

test("requesting a team confirms and replaces the form", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Your team").fill("App State");
  await page.getByRole("button", { name: /request this team/i }).click();

  // The confirmation replaces the form rather than sitting beside it, so a
  // filled-in form cannot be submitted twice by accident.
  await expect(page.locator("#request").getByRole("status")).toContainText(/got it/i);
  await expect(page.locator("#request").getByRole("status")).toBeFocused();
  await expect(page.getByRole("button", { name: /request this team/i })).toHaveCount(0);
});

test("a request without an email is still accepted", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Your team").fill("Toledo");
  await page.getByRole("button", { name: /request this team/i }).click();

  await expect(page.locator("#request").getByRole("status")).toBeVisible();
});

test("a malformed email is reported in fan-readable text", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Your team").fill("Toledo");
  await page.getByLabel(/email/i).fill("nope");
  await page.getByRole("button", { name: /request this team/i }).click();

  // Scoped to the section: Next.js renders its own role="alert" route
  // announcer at the document root, which an unscoped query also matches.
  await expect(page.locator("#request").getByRole("alert")).toContainText(
    /email address does not look right/i,
  );
});

test("in-page navigation clears the sticky masthead", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("link", { name: "Request a team" }).click();

  const heading = page.getByRole("heading", { name: /most teams do not get covered/i });
  await expect(heading).toBeVisible();

  // scroll-margin has to clear the sticky bar, or the anchor lands the heading
  // underneath it.
  const headingBox = await heading.boundingBox();
  const mastheadBox = await page.locator("header").boundingBox();
  expect(headingBox).not.toBeNull();
  expect(mastheadBox).not.toBeNull();
  expect(headingBox!.y).toBeGreaterThanOrEqual(mastheadBox!.y + mastheadBox!.height);
});

test("light is the default and the theme choice persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const shell = page.locator("main[data-theme]");

  await expect(shell).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Color theme: Light. Change theme." }).click();
  await expect(shell).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(shell).toHaveAttribute("data-theme", "dark");
});

// The masthead and an edition page share a storage key, so a fan who picks
// dark on one surface does not get flashed back to light on the other.
test("the theme choice carries between the home page and an edition", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Color theme: Light. Change theme." }).click();
  await expect(page.locator("main[data-theme]")).toHaveAttribute("data-theme", "dark");

  await page.goto("/teams/texas-football");
  await expect(page.locator("main[data-theme]")).toHaveAttribute("data-theme", "dark");
});

for (const width of [1440, 768, 414, 375, 320]) {
  test(`the home page avoids horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `home overflow at ${width}px`).toBeLessThanOrEqual(1);
  });
}

test("team requests are accepted without an email and validated", async ({ request }) => {
  const accepted = await request.post("/api/team-requests", {
    data: { teamName: "Coastal Carolina" },
  });
  expect(accepted.status()).toBe(202);
  expect(((await accepted.json()) as { ok: boolean }).ok).toBe(true);

  const rejected = await request.post("/api/team-requests", {
    data: { teamName: "A" },
  });
  expect(rejected.status()).toBe(400);
  expect(((await rejected.json()) as { error: string }).error).toMatch(/which team you follow/i);
});

// The headline is two parallel sentences, so it breaks on the sentence
// boundary rather than wherever the measure lands. Left to the browser it
// orphaned "section." on a line of its own.
for (const width of [1440, 768, 375, 320]) {
  test(`the hero headline holds two lines at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const lines = page.getByRole("heading", { level: 1 }).locator("span");
    await expect(lines).toHaveCount(2);

    // One rendered line each: a span taller than its own line-height means a
    // sentence wrapped and the orphan is back.
    for (const line of await lines.all()) {
      const box = await line.boundingBox();
      const fontSize = await line.evaluate((node) =>
        Number.parseFloat(getComputedStyle(node).fontSize),
      );
      expect(box!.height, `wrapped at ${width}px`).toBeLessThan(fontSize * 1.5);
    }
  });
}
