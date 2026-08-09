import { recordTeamRequest, teamRequestSchema } from "@/server/requests/team-requests";

export const runtime = "nodejs";

// A speed bump, not a real rate limiter: serverless instances do not share
// memory, so a determined submitter gets a fresh allowance per warm instance.
// It exists to stop an accidental double-submit or someone holding down enter;
// the honest fix if this ever matters is a shared store.
//
// The ceiling is deliberately generous. A fan may legitimately request several
// teams in a sitting, and every request that a limit wrongly rejects is demand
// data thrown away — the failure mode of being too strict is worse than the
// failure mode of being too loose.
//
// Note the key collapses to "unknown" without an x-forwarded-for header, so
// everything from a single origin shares one bucket locally.
const windowMs = 60_000;
const maxPerWindow = 20;
const recentSubmissions = new Map<string, number[]>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;

  if (body === null || typeof body !== "object") {
    return Response.json({ error: "Send a team name." }, { status: 400 });
  }

  const parsed = teamRequestSchema.safeParse(body);

  if (!parsed.success) {
    // Surface the first field message rather than a Zod dump — this text is
    // read by a fan, not a developer.
    const [issue] = parsed.error.issues;

    return Response.json(
      { error: issue?.message ?? "That request could not be read." },
      { status: 400 },
    );
  }

  const key = clientKey(request);

  if (key !== null && isRateLimited(key)) {
    return Response.json(
      { error: "That went through already. Give it a minute before sending another." },
      { status: 429 },
    );
  }

  const result = await recordTeamRequest(parsed.data);

  // Accepted either way: the request is always written to the server log, so a
  // deploy without a database still captures demand. `stored` lets the caller
  // distinguish durable from log-only without changing what the fan is told,
  // because from their side the outcome is identical.
  return Response.json({ ok: true, stored: result.stored }, { status: 202 });
}

// Null when the caller cannot be told apart from anyone else. Bucketing every
// such request under a shared "unknown" key would turn a per-person speed bump
// into a global cap — one visitor could then lock the form for everybody, and
// so could any proxy that strips the header. Given the endpoint costs nothing
// to serve and rejecting a request means throwing away demand data, failing
// open is the better trade here.
function clientKey(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  return first ? first : null;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (recentSubmissions.get(key) ?? []).filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (recent.length >= maxPerWindow) {
    recentSubmissions.set(key, recent);

    return true;
  }

  recent.push(now);
  recentSubmissions.set(key, recent);

  // Bound the map so a long-lived instance does not accumulate keys forever.
  if (recentSubmissions.size > 1_000) {
    for (const [existingKey, timestamps] of recentSubmissions) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
        recentSubmissions.delete(existingKey);
      }
    }
  }

  return false;
}
