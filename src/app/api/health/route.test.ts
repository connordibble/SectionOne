// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

type HealthBody = {
  ok: boolean;
  databaseConfigured: boolean;
  enabledTeams: string[];
  llm: {
    provider: string;
    model: string;
    source: string;
    mode: string;
    monthToDateUsd?: string | null;
    attribution?: string;
  };
  embeddings: { provider: string; model: string; source: string };
  sources: Record<string, Array<{ label: string; state: string }>>;
};

async function health(token?: string): Promise<HealthBody> {
  const response = await GET(
    new Request("https://example.test/api/health", {
      headers: token === undefined ? {} : { "x-health-token": token },
    }),
  );

  expect(response.status).toBe(200);

  return (await response.json()) as HealthBody;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports service, LLM provider, and source readiness", async () => {
    const body = await health();

    expect(body.ok).toBe(true);
    expect(body.enabledTeams).toEqual(["texas-football", "utah-state-football"]);
    expect(["mock", "anthropic", "openai"]).toContain(body.llm.provider);
    expect(["mock", "openai"]).toContain(body.embeddings.provider);
    expect(body.sources["texas-football"]).toContainEqual(
      expect.objectContaining({ id: "schedule", label: "Schedule", state: "Ready" }),
    );
  });

  // The three states are deliberately not a boolean. A missing database costs
  // attribution, not cost safety, because the ceiling lives on the Anthropic
  // workspace — so "no database" is a supported mode, not a failure.
  it("reports composer-only when no live provider is configured", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("HEALTH_TOKEN", "s3cret");

    // Attribution is gated, so these read the endpoint as an operator would.
    const body = await health("s3cret");

    expect(body.llm.mode).toBe("composer-only");
    expect(body.llm.monthToDateUsd).toBeNull();
    expect(body.llm.attribution).toContain("no live provider");
  });

  it("reports live-unmetered when a provider is live but there is no database", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("HEALTH_TOKEN", "s3cret");

    const body = await health("s3cret");

    expect(body.llm.mode).toBe("live-unmetered");
    expect(body.databaseConfigured).toBe(false);
    // Null must never be rendered as $0 — nothing is known, not nothing spent.
    expect(body.llm.monthToDateUsd).toBeNull();
    expect(body.llm.attribution).toContain("Anthropic workspace");
  });

  it("reports live-metered when a provider and a database are both configured", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@127.0.0.1:5432/unreachable");
    vi.stubEnv("HEALTH_TOKEN", "s3cret");

    const body = await health("s3cret");

    expect(body.llm.mode).toBe("live-metered");
    expect(body.databaseConfigured).toBe(true);
    expect(body.llm.attribution).toBe("recorded");
  }, 20_000);
});

// Spend is business data on a public, unauthenticated endpoint. Anyone could
// watch the number move and infer traffic.
describe("health spend disclosure", () => {
  it("omits spend for an unauthenticated caller", async () => {
    vi.stubEnv("HEALTH_TOKEN", "s3cret");
    const body = await health();

    expect(body.llm).not.toHaveProperty("monthToDateUsd");
    expect(body.llm).not.toHaveProperty("attribution");
    // The rest stays public so uptime checks keep working.
    expect(body.ok).toBe(true);
    expect(body.llm.mode).toBeDefined();
  });

  it("omits spend for a wrong token", async () => {
    vi.stubEnv("HEALTH_TOKEN", "s3cret");

    expect(await health("nope")).not.toHaveProperty("llm.monthToDateUsd");
  });

  it("reveals spend for the configured token", async () => {
    vi.stubEnv("HEALTH_TOKEN", "s3cret");

    expect(await health("s3cret")).toHaveProperty("llm.attribution");
  });

  // A deployment that forgot the variable must not be wide open.
  it("fails closed when no token is configured", async () => {
    vi.stubEnv("HEALTH_TOKEN", "");

    expect(await health("anything")).not.toHaveProperty("llm.attribution");
  });
});
