import { redact } from "./report";

// Swap the recipient by setting ALERT_EMAIL_TO. The literal below is the
// fallback so a deployment that forgets the variable still reaches a person
// rather than silently dropping alerts.
//
// If this repository is ever made public, move this address out of source and
// make ALERT_EMAIL_TO required — a plain address in a public repo is scraped
// within days.
const fallbackRecipient = "dibbleconnor@gmail.com";

// Resend's REST API, called with fetch rather than their SDK. One less
// dependency to keep current, and the request is four lines.
const endpoint = "https://api.resend.com/emails";

// Looser than NodeJS.ProcessEnv on purpose, matching LlmEnv: callers and tests
// pass plain objects rather than constructing a full process environment.
export type AlertEnv = Record<string, string | undefined>;

export type AlertConfig = {
  apiKey: string;
  to: string;
  from: string;
};

export type AlertResult = "sent" | "skipped: not configured" | "skipped: non-production" | "failed";

// Returns null when alerting is not configured rather than throwing. A missing
// key is a normal state in development, in CI, and on any deployment that has
// not set one up — none of which should fail because of it.
export function resolveAlertConfig(env: AlertEnv = process.env): AlertConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    to: env.ALERT_EMAIL_TO?.trim() || fallbackRecipient,
    // Must be a domain verified with the provider. Resend's shared sender
    // works for a first smoke test but is rate limited and lands in spam.
    from: env.ALERT_EMAIL_FROM?.trim() || "alerts@sectiononesports.com",
  };
}

// Only production sends mail. Locally and in CI an alert is a log line, which
// is what you want when a test suite deliberately throws.
export function alertingEnabled(env: AlertEnv = process.env): boolean {
  if (env.ALERT_FORCE === "1") {
    return true;
  }

  return env.NODE_ENV === "production";
}

export async function sendAlert(
  message: { subject: string; body: string },
  env: AlertEnv = process.env,
): Promise<AlertResult> {
  if (!alertingEnabled(env)) {
    console.warn(`[alert:not-sent] ${message.subject}`);

    return "skipped: non-production";
  }

  const config = resolveAlertConfig(env);

  if (!config) {
    console.warn(`[alert:unconfigured] ${message.subject}`);

    return "skipped: not configured";
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.to],
        subject: message.subject,
        // Redacted a second time here. `report.ts` already does it, but this
        // is the last point before the text leaves the process, and every
        // future caller of sendAlert inherits the guarantee.
        text: redact(message.body),
      }),
      // An unreachable provider must not hold a serverless invocation open
      // until the platform kills it.
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`[alert:failed] ${response.status} for ${message.subject}`);

      return "failed";
    }

    return "sent";
  } catch (error) {
    // Never rethrow. The caller is already handling something worse.
    console.error(`[alert:failed] ${String(error)}`);

    return "failed";
  }
}
