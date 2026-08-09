import { expect, test } from "@playwright/test";

test("loads the Saturday Signal shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Saturday Signal" })).toBeVisible();
  await expect(page.getByText("Texas football reference deployment")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Saturday Signal" })).toBeVisible();
  await expect(page.getByText("Independent fan project")).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026 schedule" })).toBeVisible();
});

test("loads the canonical Texas football route", async ({ page }) => {
  await page.goto("/teams/texas-football");

  await expect(page.getByRole("heading", { name: "Saturday Signal" })).toBeVisible();
  await expect(page.getByTestId("kickoff-lead")).toBeVisible();
});

test("leads with a real kickoff countdown, never an invented figure", async ({ page }) => {
  await page.goto("/");

  // The lead figure is the largest thing on the page, so it has to be honest:
  // a day count, "Today", or "TBD" — never a fabricated number.
  const lead = page.getByTestId("kickoff-lead");
  await expect(lead).toBeVisible();
  // The figure and its unit are separate elements, so textContent runs them
  // together as "28days out" — \s* rather than \s+.
  await expect(lead).toContainText(/^(\d+\s*days?\s*out|Today|TBD)/);
  await expect(lead.getByRole("heading", { level: 2 })).toContainText("Texas");
});

test("desktop reading order runs lead, chat, schedule, sources in one column", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "desktop-only layout contract");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // The Stat-Led contract: a single reading column with a strict vertical
  // order — the lead figure, then the workspace, then supporting data, then
  // sourcing. Asserted through element relationships rather than pixel
  // heights so copy changes don't break it.
  const layout = await page.evaluate(() => {
    const ids = ["kickoff-lead", "team-chat-panel", "schedule-strip", "source-colophon"];
    const rects = ids.map((id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);

      if (!node) {
        throw new Error(`Expected [data-testid="${id}"] to be present.`);
      }

      return node.getBoundingClientRect();
    });

    return {
      inVerticalOrder: rects.every(
        (rect, index) => index === 0 || rect.top >= rects[index - 1].bottom - 1,
      ),
      sharesOneColumn: rects.every((rect) => Math.abs(rect.left - rects[0].left) <= 1),
      columnIsReadable: rects[1].width <= 1200,
    };
  });

  expect(layout.inVerticalOrder).toBe(true);
  expect(layout.sharesOneColumn).toBe(true);
  expect(layout.columnIsReadable).toBe(true);
});

for (const width of [1440, 768, 414, 375, 320]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    // Allow 1px for sub-pixel rounding; anything more is a real overflow.
    expect(overflow).toBeLessThanOrEqual(1);
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

test("chat API can stream server-sent events", async ({ request }) => {
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

test("chat UI streams a grounded answer with citations", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask Saturday Signal" }).click();

  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();
  await expect(page.getByRole("link", { name: /Texas football 2026 schedule/i })).toBeVisible();
});

test("chat UI holds a multi-turn conversation", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Ask Saturday Signal").fill("Give me the next-game briefing.");
  await page.getByRole("button", { name: "Ask Saturday Signal" }).click();
  await expect(page.getByText("Texas opens the 2026 schedule vs Texas State")).toBeVisible();

  await page.getByLabel("Ask Saturday Signal").fill("How does Ohio State look?");
  await page.getByRole("button", { name: "Ask Saturday Signal" }).click();

  await expect(page.getByText("How does Ohio State look?")).toBeVisible();
  await expect(
    page.getByText(/Ohio State in week two is the schedule's first real line-of-scrimmage test/),
  ).toBeVisible();
  await expect(page.getByText("Give me the next-game briefing.")).toBeVisible();
});
