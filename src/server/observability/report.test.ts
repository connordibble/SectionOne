// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redact } from "./report";
import { alertingEnabled, resolveAlertConfig, sendAlert } from "./alert";

describe("redact", () => {
  // A leaked key is not recoverable; a redacted alert is still actionable.
  it("removes credentials that would otherwise reach a log or an inbox", () => {
    expect(redact("key sk-ant-api03-abcdefghijklmnop failed")).toContain("sk-[redacted]");
    expect(redact("Authorization: Bearer eyJhbGciOiJIUzI1NiIs")).toContain("Bearer [redacted]");
    expect(redact("postgres://user:hunter2@db.neon.tech/main")).toBe("postgres://[redacted]");
  });

  // A fan's address can reach an error path through the request form. It is
  // theirs, and it has no diagnostic value.
  it("removes email addresses", () => {
    expect(redact("failed for fan@example.com on submit")).toBe(
      "failed for [email redacted] on submit",
    );
  });

  it("leaves ordinary diagnostic text alone", () => {
    expect(redact("ECONNREFUSED 127.0.0.1:5432 after 3 retries")).toBe(
      "ECONNREFUSED 127.0.0.1:5432 after 3 retries",
    );
  });
});

describe("alert configuration", () => {
  it("treats a missing key as unconfigured rather than an error", () => {
    expect(resolveAlertConfig({})).toBeNull();
  });

  // The recipient is meant to be swapped by env when a project address exists.
  it("prefers ALERT_EMAIL_TO over the built-in fallback", () => {
    const config = resolveAlertConfig({
      RESEND_API_KEY: "re_test",
      ALERT_EMAIL_TO: "alerts@sectiononesports.com",
    });

    expect(config?.to).toBe("alerts@sectiononesports.com");
  });

  it("falls back to a real address so a forgotten variable still reaches someone", () => {
    const config = resolveAlertConfig({ RESEND_API_KEY: "re_test" });

    expect(config?.to).toContain("@");
  });

  // A test suite that deliberately throws must not send mail.
  it("only sends from production unless explicitly forced", () => {
    expect(alertingEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(alertingEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(alertingEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(alertingEnabled({ NODE_ENV: "test", ALERT_FORCE: "1" })).toBe(true);
  });
});

describe("sendAlert", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not call out at all outside production", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await sendAlert({ subject: "s", body: "b" }, {
      NODE_ENV: "test",
      RESEND_API_KEY: "re_test",
    });

    expect(result).toBe("skipped: non-production");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redacts the body one last time before it leaves the process", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await sendAlert({ subject: "s", body: "db postgres://u:p@host/db down" }, {
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test",
      ALERT_EMAIL_TO: "ops@example.com",
    });

    const sent = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { text: string };
    expect(sent.text).not.toContain("hunter");
    expect(sent.text).toContain("postgres://[redacted]");
  });

  // The caller is already handling something worse. Alerting must never be the
  // thing that turns a handled error into an unhandled one.
  it("never throws when the provider is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(
      sendAlert({ subject: "s", body: "b" }, {
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
      }),
    ).resolves.toBe("failed");
  });

  it("reports a provider rejection as failed rather than sent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 422 }));

    await expect(
      sendAlert({ subject: "s", body: "b" }, {
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test",
      }),
    ).resolves.toBe("failed");
  });
});
