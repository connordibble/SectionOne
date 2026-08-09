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
in the same change. Budget alongside the Anthropic ceiling — $15/month for the
model plus $20/month for hosting once monetized.

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
   | `OPENAI_API_KEY` | Production | Also enables real embeddings, which the semantic cache tier needs. |
   | `LLM_PROVIDER` | Production | `openai`. Auto-detection prefers Anthropic whenever its key is present, so without this the credits sit unused. |
   | `DATABASE_URL` | Production | Neon **pooled** string. Omit to run without a ledger, cache, or stored team requests. |
   | `LLM_MONTHLY_BUDGET_USD` | Production | Soft ceiling. Trips before the provider limit and degrades to composer answers. `off` to disable. |
   | `HEALTH_TOKEN` | Production | `openssl rand -hex 32`. Without it `/api/health` withholds spend and provider identity from everyone. |
   | `RESEND_API_KEY` | Production | Enables alert email. Absent means log-only. |
   | `ALERT_EMAIL_TO` | Production | Recipient. Overrides the fallback in `alert.ts`. |
   | `CFBD_API_KEY` | — | Only needed to run `pnpm schedule:build` locally. |
   | `NEXT_PUBLIC_SITE_URL` | — | Leave unset. Vercel supplies the production URL, and previews then describe themselves rather than claiming to be production. |

   Do **not** set `LLM_PROVIDER` in Preview. Previews should stay on the
   composer so a pull request cannot spend money.

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

The in-process limiter in `/api/team-requests` is a speed bump, not a control:
serverless instances do not share memory, so a determined caller gets a fresh
allowance per warm instance. Do the real limiting at the Cloudflare edge, where
it is free and rejects traffic before it reaches an instance.

Cloudflare → Security → WAF → Rate limiting rules:

| Rule | Match | Limit | Action |
| --- | --- | --- | --- |
| chat | `http.request.uri.path eq "/api/chat"` | 20 / 1 min per IP | Block, 60s |
| requests | `http.request.uri.path eq "/api/team-requests"` | 10 / 1 min per IP | Managed challenge |
| ingest | `http.request.uri.path eq "/api/ingest"` | 5 / 1 min per IP | Block, 60s |

`/api/chat` is the one that spends money, so it gets the tightest real limit.
There are now three layers, and each covers what the others cannot: the OpenAI
project limit stops a catastrophic bill, `LLM_MONTHLY_BUDGET_USD` trips first
and degrades to composer answers instead of provider errors, and this edge rule
stops one enthusiastic visitor exhausting either.

## Verifying a deploy

```bash
curl -sI https://sectiononesports.com | grep -i content-security-policy
curl -s  https://sectiononesports.com/api/health | jq '.ok, .llm.mode'
curl -s -H "x-health-token: $HEALTH_TOKEN" \
     https://sectiononesports.com/api/health | jq '.llm.monthToDateUsd'
curl -s  https://sectiononesports.com/robots.txt
```

Expect `llm.mode` to be `live-metered` with a key and a database,
`live-unmetered` with a key and none, and `composer-only` with neither. The
unauthenticated call must not contain `monthToDateUsd` at all.

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
