import { reportDegradation } from "@/server/observability/report";

// Per-instance, in-memory, and honest about it.
//
// Serverless instances do not share memory, so a determined caller gets a
// fresh allowance per warm instance. This is defence in depth, not the
// control: the real limit belongs at the Cloudflare edge, where it rejects
// traffic before it reaches an instance at all (see docs/deploy.md).
//
// It is still worth having. It survives a Cloudflare misconfiguration, it
// covers direct-to-origin traffic that bypasses the proxy, and it stops the
// ordinary case — one person holding down enter — without a round trip.
export type RateLimitRule = {
  name: string;
  windowMs: number;
  max: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const buckets = new Map<string, number[]>();

// Null when the caller cannot be told apart from anyone else.
//
// Bucketing every such request under a shared "unknown" key would turn a
// per-person limit into a global one: a single visitor could lock the endpoint
// for everybody, and so could any proxy that strips the header.
export function clientKey(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  if (first) {
    return first;
  }

  // Cloudflare sets this even when x-forwarded-for is rewritten.
  return request.headers.get("cf-connecting-ip")?.trim() || null;
}

// The chat endpoint spends money, so it gets the tightest limit.
//
// Ten a minute is a question every six seconds, sustained. Nobody reading a
// briefing does that, and the composer blocks submission while an answer is
// streaming, so one session cannot reach it without deliberately trying. It was
// twenty; the argument for the smaller number is that the gap between real use
// and the ceiling was never doing any work.
//
// The case to watch is a shared address — campus wifi or carrier NAT, a
// plausible way to reach a college football audience — where one budget covers
// everyone behind it. A limit hit logs `http/rate-limit:chat`, so that arrives
// as a pattern rather than a mystery.
const defaultChatRequestsPerMinute = 10;

// Overridable because the end-to-end suite runs every browser from 127.0.0.1,
// so a dozen chat tests draw on one visitor's allowance and fail on a limit no
// reader would reach. Raising it there tests the product; lowering the product
// to suit the harness would not. It lives here rather than in the route because
// a Next route module may only export handlers.
export function resolveChatRateLimit(
  env: Record<string, string | undefined> = process.env,
): RateLimitRule {
  const parsed = Number(env.CHAT_RATE_LIMIT_PER_MINUTE);
  const max = Number.isInteger(parsed) && parsed > 0 ? parsed : defaultChatRequestsPerMinute;

  return { name: "chat", windowMs: 60_000, max };
}

export function checkRateLimit(request: Request, rule: RateLimitRule): RateLimitResult {
  const key = clientKey(request);

  // Fails open by design. On an endpoint that costs money this is a real
  // trade, and it is the right one only because the edge limit and the spend
  // ceiling both sit behind it.
  if (key === null) {
    return { allowed: true };
  }

  const now = Date.now();
  const bucketKey = `${rule.name}:${key}`;
  const recent = (buckets.get(bucketKey) ?? []).filter(
    (timestamp) => now - timestamp < rule.windowMs,
  );

  if (recent.length >= rule.max) {
    buckets.set(bucketKey, recent);
    reportDegradation(`rate limit hit on ${rule.name}`, {
      scope: `http/rate-limit/${rule.name}`,
      fingerprint: `http/rate-limit:${rule.name}`,
    });

    const oldest = recent[0] ?? now;

    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rule.windowMs - (now - oldest)) / 1000)),
    };
  }

  recent.push(now);
  buckets.set(bucketKey, recent);
  pruneIfLarge(now);

  return { allowed: true };
}

// Bounds the map so a long-lived instance cannot accumulate keys forever.
function pruneIfLarge(now: number): void {
  if (buckets.size <= 5_000) {
    return;
  }

  for (const [key, timestamps] of buckets) {
    if (timestamps.every((timestamp) => now - timestamp >= 60 * 60 * 1000)) {
      buckets.delete(key);
    }
  }
}

export function rateLimitResponse(result: Extract<RateLimitResult, { allowed: false }>): Response {
  return Response.json(
    { error: "That is a lot of questions at once. Give it a moment and try again." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
