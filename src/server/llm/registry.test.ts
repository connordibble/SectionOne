// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeLlmProvider, resolveLlmProvider } from "./registry";

describe("LLM provider registry", () => {
  it("defaults to the mock provider when no keys are configured", () => {
    const resolved = resolveLlmProvider({});

    expect(resolved.provider.name).toBe("mock");
    expect(resolved.warning).toBeUndefined();
  });

  it("auto-detects anthropic when only its key is present", () => {
    const resolved = resolveLlmProvider({ ANTHROPIC_API_KEY: "sk-test" });

    expect(resolved.provider.name).toBe("anthropic");
    expect(resolved.provider.model).toBe("claude-haiku-4-5");
  });

  it("prefers anthropic over openai when both keys are present", () => {
    const resolved = resolveLlmProvider({
      ANTHROPIC_API_KEY: "sk-a",
      OPENAI_API_KEY: "sk-o",
    });

    expect(resolved.provider.name).toBe("anthropic");
  });

  it("honors an explicit LLM_PROVIDER choice", () => {
    const resolved = resolveLlmProvider({
      LLM_PROVIDER: "openai",
      ANTHROPIC_API_KEY: "sk-a",
      OPENAI_API_KEY: "sk-o",
      OPENAI_MODEL: "gpt-test",
    });

    expect(resolved.provider.name).toBe("openai");
    expect(resolved.provider.model).toBe("gpt-test");
  });

  it("falls back to mock with a warning when the explicit provider has no key", () => {
    const resolved = resolveLlmProvider({ LLM_PROVIDER: "anthropic" });

    expect(resolved.provider.name).toBe("mock");
    expect(resolved.warning).toContain("ANTHROPIC_API_KEY");
  });

  it("falls back to mock with a warning for an unknown provider name", () => {
    const resolved = resolveLlmProvider({ LLM_PROVIDER: "grok" });

    expect(resolved.provider.name).toBe("mock");
    expect(resolved.warning).toContain('Unknown LLM_PROVIDER "grok"');
  });

  it("describes the active provider for health checks", () => {
    const status = describeLlmProvider({ LLM_PROVIDER: "mock" });

    expect(status).toMatchObject({
      provider: "mock",
      source: "explicit",
    });
    expect(describeLlmProvider({}).source).toBe("auto");
  });
});
