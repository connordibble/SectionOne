import { expect, test } from "@playwright/test";

test("loads the finished Section One workspace", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await expect(
    page.getByRole("heading", { name: "Texas vs Texas State", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Texas · Week 1 · 2026 · SEC/)).toBeVisible();
  await expect(page.getByText("Saturday edition")).toHaveCount(1);
  // The wordmark is typeset, not placed. The raster it replaced carried a
  // baked cream ground, which is what stopped the masthead following the theme.
  const wordmark = page.getByRole("link", { name: "Section One home" }).first();
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveText(/SectionOne/i);
  await expect(wordmark.locator("img")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Brief" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("img", { name: /Kickoff clock:/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What matters Saturday" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tune your signal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next three" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  await expect(page.getByText(/Schedule updated July 1, 2026/)).toBeVisible();
});

test("loads the canonical Texas route with a real kickoff figure", async ({ page }) => {
  await page.goto("/teams/texas-football");

  const lead = page.getByTestId("kickoff-lead");
  await expect(lead).toBeVisible();
  await expect(page.getByRole("img", { name: /Kickoff clock:/ })).toHaveAttribute(
    "aria-label",
    /^Kickoff clock: (\d+\s*days?\s*out|Today|Kickoff to be announced)$/,
  );
  await expect(lead.getByRole("heading", { level: 1 })).toContainText("Texas");
});

test("coverage tabs are shareable and keyboard navigable", async ({ page }) => {
  await page.goto("/teams/texas-football#matchup");

  const matchupTab = page.getByRole("tab", { name: "Matchup" });
  await expect(matchupTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("signal-board")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matchup map", level: 1 })).toBeVisible();

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

test("view changes keep browser history and return focus to the active tab", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await page.getByRole("tab", { name: "Matchup" }).click();
  await page.getByRole("tab", { name: "Schedule" }).click();
  await page.goBack();

  await expect(page).toHaveURL(/#matchup$/);
  await expect(page.getByRole("tab", { name: "Matchup" })).toBeFocused();
  await expect(page.getByTestId("signal-board")).toBeVisible();
});

test("full schedule sends focus to the new coverage tab", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await page.getByRole("button", { name: "Full schedule" }).click();

  await expect(page).toHaveURL(/#schedule$/);
  await expect(page.getByRole("tab", { name: "Schedule" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "2026 schedule", level: 1 })).toBeVisible();
});

test("the Signal Board turns a selected cue into a focused question", async ({ page }) => {
  await page.goto("/teams/texas-football#matchup");

  const pressureCue = page.getByRole("button", { name: /Pressure with four/ });
  await pressureCue.click();
  await expect(pressureCue).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Interior pressure lets Texas hurry the quarterback/)).toBeVisible();

  await page.getByRole("button", { name: "Ask about this" }).click();
  const composer = page.getByLabel("Ask Section One");
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

// The second edition is the test of the config thesis: a team outside the
// blue-blood tier should be a data change, not a redesign.
test("the Utah State edition renders its own schedule, notes, and accent", async ({ page }) => {
  const accentOf = () =>
    page.evaluate(() =>
      getComputedStyle(document.querySelector("main")!).getPropertyValue("--team-accent").trim(),
    );

  await page.goto("/teams/utah-state-football");
  await expect(page.getByText(/Utah State · Week 1 · 2026 · Pac-12/)).toBeVisible();
  await expect(page.getByTestId("kickoff-lead")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What matters Saturday" })).toBeVisible();
  await expect(page.getByText(/Idaho State/).first()).toBeVisible();

  const aggieAccent = await accentOf();
  expect(aggieAccent).toMatch(/^oklch\(/);

  await page.goto("/teams/texas-football");
  expect(await accentOf()).not.toBe(aggieAccent);
});

test("the team switcher moves between editions", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await page.getByLabel("Team").selectOption("utah-state-football");

  await expect(page).toHaveURL(/\/teams\/utah-state-football$/);
  await expect(page.getByText(/Utah State · Week 1 · 2026 · Pac-12/)).toBeVisible();
});

// The promoted prompt for a two-word team name used to escalate to a paid
// answer because the classifier reserved a single word for the team.
test("the Utah State next-game prompt is answered from Utah State sources", async ({ page }) => {
  await page.goto("/teams/utah-state-football");

  await page.getByLabel("Ask Section One").fill("Who does Utah State play next?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  // Scoped to the answer: the venue also appears in the hero, so an unscoped
  // match would pass without the chat having answered anything.
  const answer = page.getByText(/Utah State opens the 2026 schedule vs Idaho State/);
  await expect(answer).toBeVisible();
  await expect(answer).toContainText("Maverik Stadium, Logan, Utah");
});

// For most of the country the useful poll question is not "who is No. 1" but
// "which of my weeks are the hard ones".
test("the field section reads an unranked team's schedule, not a national list", async ({
  page,
}) => {
  await page.goto("/teams/utah-state-football");
  const field = page.locator('[aria-labelledby="ranking-heading"]');

  await expect(field.getByText("Unranked")).toBeVisible();
  await expect(field.getByText(/2 of 12 opponents ranked/)).toBeVisible();
  await expect(field.getByText("at Washington")).toBeVisible();
  await expect(field.getByText("at Utah")).toBeVisible();
  // A poll that has not been released is not a poll with nobody in it.
  await expect(field.getByText(/AP Top 25 is out August 17/)).toBeVisible();
});

test("the field section leads with a ranked team's own number", async ({ page }) => {
  await page.goto("/teams/texas-football");
  const field = page.locator('[aria-labelledby="ranking-heading"]');

  await expect(field.getByText(/No\.\s*4/).first()).toBeVisible();
  await expect(field.getByText(/7 of 12 opponents ranked/)).toBeVisible();
  await expect(field.locator("li")).toHaveCount(5);
  await expect(field.getByText(/2 more ranked opponents/)).toBeVisible();
});

test("this week carries a headline, a takeaway, and the outlet behind it", async ({ page }) => {
  await page.goto("/teams/utah-state-football");
  const news = page.locator('[aria-labelledby="news-heading"]');

  // Ranked by the rubric, not by the order the package was written: the
  // highest-impact story leads and the official announcements sink.
  await expect(news.locator("li").first()).toContainText(/four offensive starters/i);
  await expect(news.getByText(/Almost the whole offense turned over/)).toBeVisible();
  await expect(news.getByText(/Deseret News/)).toBeVisible();

  // No outlet owns the list. The first Texas package was three of five from
  // one national masthead, which is one desk's read of the week presented as
  // the week.
  const outlets = await news.locator("li p:last-child").allInnerTexts();
  const mastheads = outlets.map((line) => line.split("·")[0].trim());
  const counts = new Map<string, number>();
  for (const masthead of mastheads) {
    counts.set(masthead, (counts.get(masthead) ?? 0) + 1);
  }
  expect(new Set(mastheads).size).toBeGreaterThanOrEqual(3);
  expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);

  // The summary is ours; the reporting is not. Every item has to link out to
  // the thing it was summarised from.
  const links = news.locator("a");
  await expect(links).toHaveCount(5);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("rel", /noopener/);
  }
});

test("chat answers a poll question from the poll, not the schedule", async ({ request }) => {
  const response = await request.post("/api/chat", {
    data: { message: "Is Utah State ranked?", teamSlug: "utah-state-football" },
  });
  const body = (await response.json()) as { answer: string; citations: Array<{ title: string }> };

  expect(body.answer).toContain("not ranked");
  // Retrieval ranks the twelve schedule rows above one poll entry, so this
  // used to come back as a schedule recital under a poll question.
  expect(body.citations.map((citation) => citation.title)).toContain("Coaches Poll: Preseason");
});

test("health and ingest APIs respond", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const healthBody = (await health.json()) as {
    ok: boolean;
    enabledTeams: string[];
  };
  expect(healthBody.ok).toBe(true);
  expect(healthBody.enabledTeams).toEqual(["texas-football", "utah-state-football"]);

  const ingest = await request.post("/api/ingest", {
    data: { teamSlug: "texas-football" },
  });
  expect(ingest.ok()).toBe(true);
  const ingestBody = (await ingest.json()) as {
    teamSlug: string;
    documentCount: number;
  };
  expect(ingestBody.teamSlug).toBe("texas-football");
  expect(ingestBody.documentCount).toBe(26);
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
  await page.getByLabel("Ask Section One").fill("Give me the next-game briefing.");
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
  await page.getByLabel("Ask Section One").fill("Give me the next-game briefing.");
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
  await page.getByLabel("Ask Section One").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();

  await page.getByLabel("Ask Section One").fill("How does Ohio State look?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("How does Ohio State look?")).toBeVisible();
  await expect(
    page.getByText(/Ohio State is the first big test up front/),
  ).toBeVisible();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});
