import { defineConfig, devices } from "@playwright/test";

// Deliberately not 3000. The suite used to share a port with whatever dev
// server happened to be running, and `reuseExistingServer` would silently
// attach to it — twice that meant a full red suite that was really a stale
// build serving old code. Its own port means the suite always tests what was
// just built, and a dev server can stay up on 3000 while it runs.
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Locally a flake should be visible, not smoothed over. In CI a single retry
  // separates real failures from infrastructure noise.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // Builds every run, then serves the build. Two reasons, both learned the
    // hard way: a `next dev` here cannot start while another dev server holds
    // the project lock, and serving a build that may be stale is how the suite
    // twice reported failures that were really old code. Building first makes
    // "tested the wrong thing" impossible rather than merely unlikely.
    command: `pnpm build && pnpm start --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // The suite asserts composed answers word for word. A live key in the
      // environment would route some of them to a provider and bill for it.
      LLM_PROVIDER: "mock",
      // Next loads .env.local for the production server. Leaving the real
      // database in scope made 100 parallel browser checks queue behind one
      // postgres.js connection, so unrelated forms and streamed answers could
      // exceed their five-second UI assertions. Persistence has its own
      // dependency-injected coverage; this suite verifies the deterministic
      // degraded path and must never touch production data.
      DATABASE_URL: "",
      RESEND_API_KEY: "",
    },
  },
});
