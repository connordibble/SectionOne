import { runAfterResponse } from "@/server/http/after-response";
import { sendAlert } from "./alert";

// Two levels, and the distinction is the whole point of this module.
//
// "degraded" is something the product already handles: a ledger write failed,
// a provider fell back to the composer, a source was unavailable. It is worth
// a structured log line and worth counting. It is not worth waking anyone.
//
// "error" is something nobody designed for. It gets a log line and an alert.
//
// Alerting on both is how alerting dies: the inbox fills with things that
// resolved themselves, and the one message that mattered is buried.
export type Severity = "error" | "degraded";

export type ReportContext = {
  // Where this happened, as a stable slug: "api/chat", "llm/usage".
  scope: string;
  // Groups repeats of the same problem. Defaults to scope plus the error's
  // name, which is usually right; pass one explicitly when the message
  // contains something variable like an id.
  fingerprint?: string;
  // Small, non-sensitive facts. Redacted on the way out regardless.
  detail?: Record<string, unknown>;
};

// One alert per fingerprint per window. A hot loop that throws on every
// request would otherwise send thousands of identical emails, which is both a
// bill and a way to get the sender blocked.
const dedupeWindowMs = 15 * 60 * 1000;

// A ceiling across all fingerprints. Dedupe alone does not save you from a
// deploy that fails in twenty novel ways at once.
const maxAlertsPerWindow = 10;

const lastAlertedAt = new Map<string, number>();
let windowStartedAt = 0;
let alertsInWindow = 0;

export function reportError(error: unknown, context: ReportContext): void {
  const normalized = normalizeError(error);
  const fingerprint = context.fingerprint ?? `${context.scope}:${normalized.name}`;

  emit("error", normalized.message, { ...context, fingerprint }, normalized.stack);

  if (!shouldAlert(fingerprint)) {
    return;
  }

  // Scheduled rather than awaited: a fan waiting on an error page should not
  // also wait on an email. `after` still runs when the handler threw, which is
  // exactly the case that matters here.
  runAfterResponse(async () => {
    await sendAlert({
      subject: `[Section One] ${context.scope}: ${normalized.name}`,
      body: [
        `Scope:       ${context.scope}`,
        `Fingerprint: ${fingerprint}`,
        `Error:       ${normalized.name}: ${normalized.message}`,
        "",
        detailBlock(context.detail),
        "",
        "Stack:",
        normalized.stack ?? "(none)",
      ].join("\n"),
    });
  }, "observability/alert");
}

// Logged and counted, never alerted. The caller has already handled it.
export function reportDegradation(message: string, context: ReportContext): void {
  emit("degraded", message, context);
}

function emit(
  severity: Severity,
  message: string,
  context: ReportContext,
  stack?: string,
): void {
  // Observability must never be the reason a request fails. Everything from
  // here down is best effort.
  try {
    const line = JSON.stringify({
      level: severity === "error" ? "error" : "warn",
      severity,
      scope: context.scope,
      fingerprint: context.fingerprint,
      message: redact(message),
      detail: context.detail ? redactRecord(context.detail) : undefined,
      stack: severity === "error" && stack ? redact(stack) : undefined,
      at: new Date().toISOString(),
    });

    if (severity === "error") {
      console.error(line);
    } else {
      console.warn(line);
    }
  } catch {
    // A context object that cannot be serialized is not worth a crash.
    console.error(`[${context.scope}] ${severity}: ${message}`);
  }
}

function shouldAlert(fingerprint: string): boolean {
  const now = Date.now();

  if (now - windowStartedAt > dedupeWindowMs) {
    windowStartedAt = now;
    alertsInWindow = 0;
    lastAlertedAt.clear();
  }

  const previous = lastAlertedAt.get(fingerprint);

  if (previous !== undefined && now - previous < dedupeWindowMs) {
    return false;
  }

  if (alertsInWindow >= maxAlertsPerWindow) {
    return false;
  }

  lastAlertedAt.set(fingerprint, now);
  alertsInWindow += 1;

  return true;
}

function normalizeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { name: "NonError", message: typeof error === "string" ? error : JSON.stringify(error) };
}

// Anything shaped like a credential or a person, removed before it can reach a
// log aggregator or an inbox. Deliberately aggressive: a redacted alert is
// still actionable, a leaked key is not recoverable.
const redactions: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{8,}/g, "sk-[redacted]"],
  [/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [redacted]"],
  [/\bpostgres(?:ql)?:\/\/[^\s]*/gi, "postgres://[redacted]"],
  // A fan's email can reach here through a validation failure on the request
  // form. It is theirs, and it has no diagnostic value.
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[email redacted]"],
];

export function redact(value: string): string {
  return redactions.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function redactRecord(detail: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(detail).map(([key, value]) => [
      key,
      typeof value === "string" ? redact(value) : value,
    ]),
  );
}

function detailBlock(detail: Record<string, unknown> | undefined): string {
  if (!detail || Object.keys(detail).length === 0) {
    return "Detail: (none)";
  }

  return `Detail:\n${JSON.stringify(redactRecord(detail), null, 2)}`;
}
