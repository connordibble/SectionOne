import { withRouteErrors } from "@/server/observability/route";
import { checkRateLimit, rateLimitResponse } from "@/server/http/rate-limit";
import { recordTeamRequest, teamRequestSchema } from "@/server/requests/team-requests";

export const runtime = "nodejs";

// Generous on purpose: a fan may legitimately request several teams in a
// sitting, and every request a limit wrongly rejects is demand data thrown
// away. See src/server/http/rate-limit.ts for why this is defence in depth
// rather than the control.
const requestRateLimit = { name: "team-requests", windowMs: 60_000, max: 20 };

export const POST = withRouteErrors("api/team-requests", async (request: Request) => {
  const limit = checkRateLimit(request, requestRateLimit);

  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

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

  const result = await recordTeamRequest(parsed.data);

  // Accepted either way: the request is always written to the server log, so a
  // deploy without a database still captures demand. `stored` lets the caller
  // distinguish durable from log-only without changing what the fan is told,
  // because from their side the outcome is identical.
  return Response.json({ ok: true, stored: result.stored }, { status: 202 });
});
