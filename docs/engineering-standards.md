# Engineering standards

How this project handles failure. These are requirements for new code, not
suggestions — a pull request that adds a `try { } catch { console.log }` is
adding a blind spot.

## 1. Every failure has a severity, and they are not the same

| Severity | What it is | What happens |
| --- | --- | --- |
| **degraded** | Something the product already handles. A ledger write failed, a provider fell back to the composer, a source was unavailable. | Structured log line. **No alert.** |
| **error** | Something nobody designed for. An unhandled throw, a contract violation, a corrupt fixture. | Structured log line **and** an alert. |

```ts
import { reportDegradation, reportError } from "@/server/observability/report";

reportDegradation("spend lookup failed: connection refused", {
  scope: "llm/usage",
  fingerprint: "llm/usage:read",
});

reportError(error, { scope: "api/chat", detail: { path: "/api/chat" } });
```

**Alerting on degradations is how alerting dies.** The inbox fills with things
that resolved themselves, you start ignoring it, and the one message that
mattered is buried. If a degradation happens often enough to need attention,
that is a dashboard question, not an email.

## 2. Observability never breaks the request

Everything in `report.ts` is wrapped so it cannot throw. Alerts are dispatched
through `after()` so a fan waiting on an error page is not also waiting on an
email, and `sendAlert` resolves to `"failed"` rather than rejecting.

The rule for new code: **the reporting call is not in the happy path and never
changes control flow.** If removing every report call would change what the
function returns, the design is wrong.

## 3. Alerts are deduplicated and capped

- One alert per fingerprint per 15 minutes.
- Ten alerts per instance per 15 minutes across all fingerprints.

A hot loop that throws on every request would otherwise send thousands of
identical emails — a bill, a blocked sender, and a useless inbox.

Set `fingerprint` explicitly when the message contains something variable such
as an id or a timestamp. The default groups by scope and error name, which is
usually right and silently wrong when it is not.

**Known limit:** the dedupe map is per-instance. Serverless instances do not
share memory, so a wide outage sends one alert per warm instance. Fixing that
needs a shared store, and it has not been worth one yet.

## 4. Nothing sensitive leaves the process

`redact()` strips API keys, bearer tokens, connection strings, and email
addresses, and it runs twice: once when the report is built and again in
`sendAlert` before the text goes out. Aggressive on purpose — a redacted alert
is still actionable, a leaked key is not recoverable.

Rules for new code:

- **Never put a request body, query string, or form field in `detail`.** A fan
  typed it; it can contain anything. Paths and methods are fine.
- **Never log a fan's email.** The request form collects one and it is theirs.
- If a new kind of secret enters the codebase, add a pattern to `redactions`
  in the same change.

## 5. Public endpoints never trigger email

`/api/client-errors` exists so a browser render failure is visible, and it is
`reportDegradation` only. An unauthenticated endpoint that can reach an inbox
is an inbox anyone can fill.

It also accepts no free text: the digest must match a hex pattern and the scope
comes from an allowlist. Apply the same shape to any future endpoint the client
can call.

## 6. Route handlers are wrapped

```ts
export const POST = withRouteErrors("api/thing", async (request: Request) => { ... });
```

`withRouteErrors` turns an unexpected throw into a reported incident and a
clean JSON 500 instead of the platform's default page.

**Only the unexpected goes through it.** Validation failures, unknown slugs and
the rumour guardrail are normal outcomes the handler returns itself — routing
those through the reporter would alert on users typing things.

## 7. Errors a fan sees are written like everything else

`error.tsx`, `global-error.tsx` and `not-found.tsx` follow `DESIGN.md`: no
stack traces, no product-building language, no apology theatre. Say what
happened, say whose fault it is, and give one way forward. The 404 lists the
editions that do exist and links to the request form, because a 404 here is
usually someone guessing at a team route.

`global-error.tsx` replaces the root layout, so it carries inline styles and no
imports — whatever broke may be the fonts or the tokens.

## 8. Configuration fails safe, and "safe" depends on the thing

- **Alerting** fails *open*: no key means log-only, because a missing key must
  not take the site down.
- **The health endpoint's spend fields** fail *closed*: no `HEALTH_TOKEN` means
  nobody sees them, because a forgotten variable must not publish business data.

Decide which one a new switch is, and write down why.

## Configuration

| Variable | Effect |
| --- | --- |
| `RESEND_API_KEY` | Enables email. Absent means log-only. |
| `ALERT_EMAIL_TO` | Recipient. Overrides the fallback in `alert.ts`. |
| `ALERT_EMAIL_FROM` | Sender. Must be a domain verified with the provider. |
| `ALERT_FORCE=1` | Sends outside production. For verifying the pipeline once, not for development. |

Swapping the recipient is one environment variable. The address in `alert.ts`
is a fallback so a deployment that forgets it still reaches a person — if this
repository ever goes public, move it out of source and make the variable
required.

## 9. Caching is a correctness feature before it is a speed feature

The answer cache keys on a **corpus version** — a hash of the weekly package,
the schedule capture, and the poll week. When any of them moves, every existing
row for that team stops matching. Without that, a cached answer would be served
with this week's confidence and last week's facts, which is the one failure a
sourced product cannot absorb.

Anything added to the corpus that can change what a correct answer looks like
must go into `corpusVersion()` in the same change.

The semantic tier is gated on a real embedding provider and clamped to a
similarity of at least 0.9, default 0.97. Different questions about the same
team score as high as 0.85 simply by sharing vocabulary, so a low threshold
does not return a slightly worse answer — it returns a confident answer to a
question nobody asked.

## 10. Deferred work goes through `after`, never a bare `void`

```ts
runAfterResponse(() => storeCachedAnswer(...), "chat/cache:write");
```

`void somePromise()` and `runAfterResponse(...)` look equivalent and are not.
A serverless instance is frozen the moment the response is flushed, so an
unawaited promise is discarded mid-flight. It works perfectly in development,
where the process keeps running, and silently does nothing in production.

The answer cache shipped that way and stored zero rows in production while
passing every local test. It was only caught by querying the table after a real
request — which is the lesson as much as the rule: **a write you never read
back is not a write you have verified.**

Awaiting instead is correct but bills the fan latency for work they are not
waiting on. Use `runAfterResponse` for anything the response does not depend on.

## Still missing

- **No error tracking service.** Logs live in Vercel and are searchable but not
  aggregated, so there is no "this started 40 minutes ago" view.
- **No uptime check.** `/api/health` is built for one and nothing calls it.
- **Cross-instance dedupe**, as above.
- **No alert on the composer fallback rate.** A provider quietly failing every
  request is currently a pile of degradations nobody counts.
