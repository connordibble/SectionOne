import { reportDegradation } from "@/server/observability/report";
import { withRouteErrors } from "@/server/observability/route";

export const runtime = "nodejs";

// Deliberately logs and never alerts.
//
// This endpoint is public and unauthenticated, so anything that reaches an
// inbox from here is an inbox anyone can fill. The signal is still worth
// having: a render failure in the browser is invisible otherwise. But the
// server-side error that produced the digest already alerted from the server,
// where the trigger cannot be forged.
//
// Nothing free-text is accepted either. A digest is a short hex string Next
// generates, and the scope comes from a fixed list — so the worst an abuser
// can do is add noise to a log they cannot read.
const allowedScopes = new Set(["app/render"]);
const digestPattern = /^[a-f0-9]{1,64}$/i;

export const POST = withRouteErrors("api/client-errors", async (request: Request) => {
  const body = (await request.json().catch(() => null)) as unknown;

  if (body === null || typeof body !== "object") {
    return new Response(null, { status: 204 });
  }

  const { digest, scope } = body as { digest?: unknown; scope?: unknown };
  const safeScope = typeof scope === "string" && allowedScopes.has(scope) ? scope : "app/render";
  const safeDigest =
    typeof digest === "string" && digestPattern.test(digest) ? digest : "unavailable";

  reportDegradation(`client render failed (digest ${safeDigest})`, {
    scope: safeScope,
    fingerprint: `${safeScope}:${safeDigest}`,
  });

  // Nothing useful to say back, and a body would only invite probing.
  return new Response(null, { status: 204 });
});
