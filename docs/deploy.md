# Deploying Section One

Target: **sectiononesports.com**, DNS on Cloudflare, app on Vercel, optional
Postgres on Neon.

## Why this stack

**Vercel** runs the app. Next.js 16 is a Vercel project, and this app leans on
things adapters get wrong first — streaming SSE from `/api/chat`, per-request
dynamic rendering, and the App Router's metadata and sitemap routes. A cheaper
host that costs a weekend of adapter debugging is not cheaper.

**Neon** runs Postgres, when there is one. It has pgvector, a free tier, and
scales to zero, which matches a workload that is idle six days a week. Note the
app runs without a database at all: no `DATABASE_URL` means the deterministic
composer and log-only team requests, which is a legitimate way to launch.

**Cloudflare** keeps DNS and does the edge work Vercel charges for — rate
limiting and bot filtering — before a request costs anything.

### The one cost decision

Vercel's Hobby tier is free and **prohibits commercial use**. That is fine
today: nothing here is monetized. The day ads or paid accounts go live, Hobby
becomes a terms violation and the project must move to Pro at
**$20/developer/month**.

So: launch on Hobby, and treat "we turned on revenue" as the trigger to upgrade
in the same change. Budget for both the model provider's account-level ceiling
and paid hosting once monetized; neither external account setting is enforced
by this repository.

## First deploy

1. **Import the repo** at vercel.com → Add New → Project → `connordibble/SectionOne`.
   Framework detects as Next.js. Build command, output directory, and install
   command all stay at their defaults; pnpm is picked up from
   `packageManager` in `package.json`.

2. **Set environment variables** (Project → Settings → Environment Variables).
   Everything is optional except where noted — the app degrades to the
   composer rather than failing.

   | Variable | Scope | Notes |
   | --- | --- | --- |
   | `OPENAI_API_KEY` | Production | Enables real embeddings plus agent research and citation verification for chat. |
   | `LLM_PROVIDER` | Production | `openai`. Auto-detection prefers Anthropic whenever its key is present, so without this the credits sit unused. |
   | `DATABASE_URL` | Production | Neon **pooled** string. Omit to run without a ledger, cache, or stored team requests. |
   | `LLM_MONTHLY_BUDGET_USD` | Production | Soft ceiling. Trips before the provider limit and degrades to composer answers. `off` to disable. |
   | `HEALTH_TOKEN` | Production | `openssl rand -hex 32`. Without it `/api/health` withholds spend and provider identity from everyone. |
   | `RESEND_API_KEY` | Production | Enables alert email. Absent means log-only. |
   | `ALERT_EMAIL_TO` | Production | Recipient. Overrides the fallback in `alert.ts`. |
   | `CFBD_API_KEY` | — | Only needed to run `pnpm schedule:build` locally. |
   | `NEXT_PUBLIC_SITE_URL` | Production | `https://www.sectiononesports.com`. www is canonical; the apex 308s to it, so canonicals must name www or they point at a redirect. Leave unset in Preview so previews describe themselves. |

   Do **not** set `LLM_PROVIDER` in Preview. Previews should stay on the
   composer so a pull request cannot spend money.

   Agent research runs for every normal question when `LLM_PROVIDER=openai`.
   The first Responses turn may make up to four web searches, and a supported
   draft receives a second fact-and-citation verification turn. The local
   edition travels with the request as supporting evidence. Team-configured
   domains are preferred sources, not an allowlist. A missing, unsafe, or
   rejected citation falls back to a deterministic local answer where one
   exists, or to a reader-facing no-context answer for current roster and
   open-ended questions.

3. **Point the domain.** Vercel → Domains → add `sectiononesports.com` and
   `www.sectiononesports.com`. Vercel issues the certificate.

   In Cloudflare DNS, add the records Vercel shows. Set both to **DNS only**
   (grey cloud) for the initial verification, then switch to **Proxied**
   (orange cloud) once the certificate is issued — proxying before issuance
   makes the ACME challenge fail. Cloudflare SSL/TLS mode must be **Full
   (strict)**; Flexible would serve the site over a plaintext hop and break the
   HSTS header this app sends.

4. **Migrate the database**, if using one. Put the **direct** (non-pooled)
   Neon string in `.env.local` — the scripts load it via
   `--env-file-if-exists`, and PgBouncer's transaction mode is not a reliable
   place to run `CREATE EXTENSION` and index DDL:

   ```bash
   # .env.local
   DATABASE_URL=postgresql://...  # direct host, no -pooler
   OPENAI_API_KEY=sk-...          # must be set BEFORE seeding
   ```

   ```bash
   pnpm db:migrate   # idempotent; every migration is IF NOT EXISTS
   pnpm db:seed
   ```

   Seeding writes embeddings using whichever provider is configured. Without
   `OPENAI_API_KEY` it silently uses the offline hash embedder, which leaves
   `source_chunks` populated but semantically meaningless — vector retrieval
   and the semantic cache tier both go quiet. Check the output names `openai`.

   Vercel gets the **pooled** (`-pooler`) string instead: serverless opens a
   connection per invocation.

## Rate limiting

The in-process limiters are speed bumps, not controls: serverless instances do
not share memory, so a determined caller gets a fresh allowance per warm
instance. Do the real limiting at the Cloudflare edge so rejected traffic never
reaches an instance.

Cloudflare → Security → WAF → Rate limiting rules:

Cloudflare's [rate-limiting availability](https://developers.cloudflare.com/waf/rate-limiting-rules/)
varies by plan. Free permits one rule with a fixed 10-second counting period;
Pro permits two rules and a one-minute period; Business permits five rules and
the full table below. Configure the strongest set the active plan supports:

| Priority | Rule | Match | Limit | Action | Minimum plan |
| --- | --- | --- | --- | --- | --- |
| 1 | chat | `http.request.uri.path eq "/api/chat"` | 2 / 10 sec per IP | Block, 10s | Free |
| 2 | requests | `http.request.uri.path eq "/api/team-requests"` | 10 / 1 min per IP | Block, 60s | Pro |
| 3 | ingest | `http.request.uri.path eq "/api/ingest"` | 5 / 1 min per IP | Block, 60s | Business |

The Free chat rule tolerates ordinary reading while limiting sustained bursts.
On Pro, use its longer period to tune chat toward the origin's ten-per-minute
allowance, then add team requests. `/api/ingest` sits lower because it returns a
whole corpus and a normal visit never calls it. Watch shared addresses such as
campus wifi and carrier NAT, where one budget covers everyone behind it.

There are three layers, and each covers what the others cannot: the OpenAI
project limit stops a catastrophic bill, `LLM_MONTHLY_BUDGET_USD` trips first
and degrades to composer answers instead of provider errors, and this edge rule
stops one enthusiastic visitor exhausting either.

**This table is the intent, not the state.** As of 2026-08-28 no rate-limiting
rule is configured: twenty-one browser requests to `/api/chat` were limited by
the origin, with `x-vercel-id` on the 429. An edge rule blocks before the origin,
so that header is the check; it should be absent once the rule exists.
Tracked in [mvp1-checklist.md](./mvp1-checklist.md) § Edge Criteria, which also
records why the Browser Integrity Check already in front of the site is not a
substitute for these.

## Web analytics

`src/app/layout.tsx` mounts Vercel Web Analytics for every route. Before the
first deployment containing that component, open Vercel → Project → Analytics
and enable Web Analytics. The client then loads `/_vercel/insights/script.js`
and sends page views through `/_vercel/insights/view`.

Cloudflare may proxy those paths, but it must not cache, rewrite, challenge, or
block `/_vercel/insights/*`. After deployment, verify the script request and one
view request in the browser network panel, then confirm the visit appears in
the Vercel dashboard. The useful launch baseline is pageviews, paths, referrers,
and daily unique visitors; team paths provide the edition breakdown without a
custom event.

This is not a retention instrument. Vercel rotates its anonymous visitor
identifier daily, so it cannot distinguish a reader returning next week from a
new reader. Keep cross-day returning-reader and session/cohort measurement open
in `docs/growth-and-monetization.md` rather than treating a daily unique count as
evidence of habit.

## Verifying a deploy

```bash
curl -sI https://www.sectiononesports.com | grep -i content-security-policy
curl -s  https://www.sectiononesports.com/api/health | jq '.ok, .llm.mode'
curl -s -H "x-health-token: $HEALTH_TOKEN" \
     https://www.sectiononesports.com/api/health | jq '.llm.monthToDateUsd'
curl -s  https://www.sectiononesports.com/robots.txt
curl -sI https://www.sectiononesports.com/_vercel/insights/script.js
```

Expect `llm.mode` to be `live-metered` with a key and a database,
`live-unmetered` with a key and none, and `composer-only` with neither. The
unauthenticated call must not contain `monthToDateUsd` at all.

In a browser, also confirm each enabled edition has its own title,
self-referencing canonical, matching `og:url`, 1200×630 social image, and one
successful analytics view request.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

- **verify** — lint, typecheck, unit tests.
- **build-and-e2e** — production build, then Playwright against that build.

`LLM_PROVIDER=mock` is pinned for the whole workflow, so no CI run can reach a
provider or spend anything. Playwright browsers are cached on the lockfile
hash, and only Chromium is installed because both projects are Chromium-based.

## Still open

- **No deploy gate.** Vercel deploys on push independently of CI, so a red
  build can still ship. Fixing that means either GitHub deployment protection
  rules or moving to a `vercel deploy` step gated on CI.
- **No error tracking.** A 500 in production is currently invisible unless
  someone reads Vercel's logs.
- **No uptime check.** `/api/health` is built for one and nothing calls it.
- **CFBD's commercial terms are unreviewed.** That is a blocker before revenue,
  not before launch.
