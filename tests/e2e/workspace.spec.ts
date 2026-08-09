import { expect, test } from "@playwright/test";

test("loads the finished Saturday Signal workspace", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await expect(
    page.getByRole("heading", { name: "Saturday Signal", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Texas · Week 1 · 2026 · SEC/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Brief" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "What matters Saturday" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tune your signal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next three" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  await expect(page.getByText(/Schedule checked July 1, 2026/)).toBeVisible();
});

test("loads the canonical Texas route with a real kickoff figure", async ({ page }) => {
  await page.goto("/teams/texas-football");

  const lead = page.getByTestId("kickoff-lead");
  await expect(lead).toBeVisible();
  await expect(lead).toContainText(/^(\d+\s*days?\s*out|Today|TBD)/);
  await expect(lead.getByRole("heading", { level: 2 })).toContainText("Texas");
});

test("coverage tabs are shareable and keyboard navigable", async ({ page }) => {
  await page.goto("/teams/texas-football#matchup");

  const matchupTab = page.getByRole("tab", { name: "Matchup" });
  await expect(matchupTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("signal-board")).toBeVisible();

  await matchupTab.focus();
  await matchupTab.press("ArrowRight");
  await expect(page).toHaveURL(/#schedule$/);
  await expect(page.getByRole("tab", { name: "Schedule" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "2026 schedule" })).toBeVisible();

  await expect(page.getByRole("tab", { name: "Sources" })).toHaveCount(0);
});

test("the Signal Board turns a selected cue into a focused question", async ({ page }) => {
  await page.goto("/teams/texas-football#matchup");

  const pressureCue = page.getByRole("button", { name: /Pressure with four/ });
  await pressureCue.click();
  await expect(pressureCue).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Interior pressure lets Texas hurry the quarterback/)).toBeVisible();

  await page.getByRole("button", { name: "Ask about this" }).click();
  const composer = page.getByLabel("Ask Saturday Signal");
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue("Why does pressure with four matter?");
});

test("mobile Signal Board keeps the key picker and selected read together", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/teams/texas-football#matchup");

  const choices = page.getByRole("group", { name: "Signal keys" });
  const read = page.getByTestId("signal-board").locator("[aria-live='polite']");
  await expect(choices).toBeVisible();
  await expect(choices.getByRole("button")).toHaveCount(4);
  await expect(read).toBeVisible();

  const choicesBox = await choices.boundingBox();
  const readBox = await read.boundingBox();
  expect(choicesBox).not.toBeNull();
  expect(readBox).not.toBeNull();
  expect(readBox?.y).toBeGreaterThan(choicesBox?.y ?? 0);

  await choices.getByRole("button", { name: /Pressure with four/ }).click();
  await expect(read).toContainText("Key 03 · Ready");
  await expect(read.getByRole("heading", { name: "Pressure with four" })).toBeVisible();
});

test("light is the default and explicit theme choices cycle and persist", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/teams/texas-football");
  const shell = page.locator("main[data-theme]");

  await expect(shell).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Color theme: Light. Change theme." }).click();
  await expect(shell).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(shell).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Color theme: Dark. Change theme." }).click();
  await expect(shell).toHaveAttribute("data-theme", "light");
});

test("reduced motion removes spatial interaction movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/teams/texas-football#matchup");

  const cue = page.getByRole("button", { name: /Early downs/ });
  await cue.hover();

  await expect(cue).toHaveCSS("transform", "none");
  await expect(page.getByTestId("signal-board")).toBeVisible();
});

for (const width of [1440, 768, 414, 375, 320]) {
  test(`all three views avoid horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/teams/texas-football");

    for (const view of ["Brief", "Matchup", "Schedule"]) {
      await page.getByRole("tab", { name: view }).click();
      await expect(page.getByRole("tab", { name: view })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${view} overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("health and ingest APIs respond", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const healthBody = (await health.json()) as {
    ok: boolean;
    enabledTeams: string[];
  };
  expect(healthBody.ok).toBe(true);
  expect(healthBody.enabledTeams).toEqual(["texas-football"]);

  const ingest = await request.post("/api/ingest", {
    data: { teamSlug: "texas-football" },
  });
  expect(ingest.ok()).toBe(true);
  const ingestBody = (await ingest.json()) as {
    teamSlug: string;
    documentCount: number;
  };
  expect(ingestBody.teamSlug).toBe("texas-football");
  expect(ingestBody.documentCount).toBe(20);
});

test("chat API returns named sources", async ({ request }) => {
  const response = await request.post("/api/chat", {
    data: {
      teamSlug: "texas-football",
      message: "Give me the next-game briefing.",
    },
  });

  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    answer: string;
    citations: Array<{ title: string }>;
  };
  expect(body.answer).toContain("Texas State");
  expect(body.citations.length).toBeGreaterThanOrEqual(2);
});

test("chat API streams citations, answer text, and completion metadata", async ({ request }) => {
  const response = await request.post("/api/chat", {
    headers: { Accept: "text/event-stream" },
    data: {
      teamSlug: "texas-football",
      message: "Give me the next-game briefing.",
    },
  });

  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain("event: citations");
  expect(body).toContain("event: delta");
  expect(body).toContain("event: done");
});

test("chat streams a cited answer and keeps it across views", async ({ page }) => {
  await page.goto("/teams/texas-football");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();
  await expect(page.getByRole("link", { name: /Texas football 2026 schedule/i })).toBeVisible();

  await page.getByRole("tab", { name: "Matchup" }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your signal" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sources" })).toBeVisible();

  await page.getByRole("tab", { name: "Schedule" }).click();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});

test("the answer uses a reading column and a responsive source rail", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/teams/texas-football");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const answer = page.getByText("Texas opens the 2026 schedule vs Texas State");
  const sources = page.getByRole("complementary", { name: "Sources" });
  const threadHeading = page
    .getByRole("heading", { name: "Your signal" })
    .locator("..")
    .locator("..");
  const chatPanel = page.getByTestId("team-chat-panel");
  await expect(answer).toBeVisible();
  await expect(sources).toBeVisible();

  const desktopHeadingBox = await threadHeading.boundingBox();
  const desktopPanelBox = await chatPanel.boundingBox();
  const desktopAnswerBox = await answer.boundingBox();
  const desktopSourceBox = await sources.boundingBox();
  expect(desktopHeadingBox).not.toBeNull();
  expect(desktopPanelBox).not.toBeNull();
  expect(desktopAnswerBox).not.toBeNull();
  expect(desktopSourceBox).not.toBeNull();
  expect(desktopHeadingBox!.width).toBeGreaterThan(desktopPanelBox!.width * 0.8);
  expect(desktopAnswerBox!.y).toBeGreaterThan(
    desktopHeadingBox!.y + desktopHeadingBox!.height,
  );
  expect(desktopSourceBox!.x).toBeGreaterThan(desktopAnswerBox!.x);
  expect(Math.abs(desktopSourceBox!.y - desktopAnswerBox!.y)).toBeLessThan(100);

  await page.setViewportSize({ width: 375, height: 900 });
  const mobileAnswerBox = await answer.boundingBox();
  const mobileSourceBox = await sources.boundingBox();
  expect(mobileAnswerBox).not.toBeNull();
  expect(mobileSourceBox).not.toBeNull();
  expect(mobileSourceBox!.y).toBeGreaterThan(
    mobileAnswerBox!.y + mobileAnswerBox!.height,
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("chat supports a sourced follow-up", async ({ page }) => {
  await page.goto("/teams/texas-football");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();

  await page.getByLabel("Ask Saturday Signal").fill("How does Ohio State look?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("How does Ohio State look?")).toBeVisible();
  await expect(
    page.getByText(/Ohio State is the first big test up front/),
  ).toBeVisible();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});
