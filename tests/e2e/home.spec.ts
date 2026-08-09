import { expect, test } from "@playwright/test";

test("loads the finished Saturday Signal workspace", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Saturday Signal", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Texas · 2026 season · SEC · Independent coverage/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Brief" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "What matters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask Saturday Signal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Next three" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeVisible();
  await expect(page.getByText(/source desks ready/)).toBeVisible();
});

test("loads the canonical Texas route with a real kickoff figure", async ({ page }) => {
  await page.goto("/teams/texas-football");

  const lead = page.getByTestId("kickoff-lead");
  await expect(lead).toBeVisible();
  await expect(lead).toContainText(/^(\d+\s*days?\s*out|Today|TBD)/);
  await expect(lead.getByRole("heading", { level: 2 })).toContainText("Texas");
});

test("coverage tabs are shareable and keyboard navigable", async ({ page }) => {
  await page.goto("/#matchup");

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

  await page.getByRole("tab", { name: "Sources" }).click();
  await expect(page).toHaveURL(/#sources$/);
  await expect(page.getByRole("heading", { name: "Source ledger" })).toBeVisible();
  await expect(page.getByText("Season statistics")).toBeVisible();
});

test("the Signal Board turns a selected cue into a focused question", async ({ page }) => {
  await page.goto("/#matchup");

  const pressureCue = page.getByRole("button", { name: /Pressure with four/ });
  await pressureCue.click();
  await expect(pressureCue).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Interior wins let the defense move the quarterback/)).toBeVisible();

  await page.getByRole("button", { name: "Ask about this" }).click();
  const composer = page.getByLabel("Ask Saturday Signal");
  await expect(composer).toBeFocused();
  await expect(composer).toHaveValue("Why does pressure with four matter in the opener?");
});

test("explicit theme choices cycle and persist", async ({ page }) => {
  await page.goto("/");
  const shell = page.locator("main[data-theme]");

  await expect(shell).toHaveAttribute("data-theme", "system");
  await page.getByRole("button", { name: "Color theme: Auto. Change theme." }).click();
  await expect(shell).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Color theme: Light. Change theme." }).click();
  await expect(shell).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(shell).toHaveAttribute("data-theme", "dark");
});

test("reduced motion removes spatial interaction movement", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#matchup");

  const cue = page.getByRole("button", { name: /Early downs/ });
  await cue.hover();

  await expect(cue).toHaveCSS("transform", "none");
  await expect(page.getByTestId("signal-board")).toBeVisible();
});

for (const width of [1440, 768, 414, 375, 320]) {
  test(`all four views avoid horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    for (const view of ["Brief", "Matchup", "Schedule", "Sources"]) {
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

test("chat API returns grounded citations", async ({ request }) => {
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
  await page.goto("/");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();
  await expect(page.getByRole("link", { name: /Texas football 2026 schedule/i })).toBeVisible();

  await page.getByRole("tab", { name: "Matchup" }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The thread" })).toBeVisible();

  await page.getByRole("tab", { name: "Sources" }).click();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});

test("chat supports a grounded follow-up", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();

  await page.getByLabel("Ask Saturday Signal").fill("How does Ohio State look?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  await expect(page.getByText("How does Ohio State look?")).toBeVisible();
  await expect(
    page.getByText(/Ohio State in week two is the schedule's first real line-of-scrimmage test/),
  ).toBeVisible();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});
