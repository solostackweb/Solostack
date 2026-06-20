# Stackivo — Security & Performance: Setup Guide

One place for every external setup the security/performance work needs. Do the
**"Required now"** section to make what's already shipped (SP0-SP5 code) fully
effective; the **"Later phases"** section is here so you have the full picture,
but isn't needed to deploy today.

---

## Required now (SP0-SP5 code is live)

### 1. Upstash Redis — turns rate-limiting ON  *(required)*

The rate limiters (auth, signup, admin writes, **ticket/contact creation**,
push, portal uploads) are coded and safe, but **fail open** until Upstash is
configured — i.e. no limits are enforced without it. Free tier is **500,000
commands/month + 256 MB, free forever** — far more than 1,000 users need.

1. Go to **console.upstash.com** → sign up (GitHub login is fine).
2. **Create Database** → type **Redis** → pick a **region close to your Vercel
   region** (lower latency) → Free plan → Create.
3. On the database page, open the **REST API** section and copy:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**
4. **Vercel → Project → Settings → Environment Variables**, add both
   (Production + Preview), then **redeploy**.
5. Verify: try 7+ rapid ticket submits from the chat widget / contact form —
   you should get the "creating requests too quickly" message after the 6th.

> The npm packages (`@upstash/ratelimit`, `@upstash/redis`) are loaded lazily;
> if they aren't installed yet, run `npm i @upstash/ratelimit @upstash/redis`.

### 2. CSP — flip to enforced once verified  *(do after a few days of traffic)*

A **Content-Security-Policy is shipped in Report-Only mode** (`next.config.ts`,
`cspReportOnly`). It blocks nothing yet — it only reports violations, so it's
safe in production immediately.

To enforce it later (recommended once you've confirmed no legit violations):
1. Open the browser console on the live app across key flows (dashboard,
   checkout/Razorpay, analytics, portal video) and watch for
   `Content-Security-Policy` violation warnings.
2. Add any missing legitimate origin to the relevant directive in `cspReportOnly`.
3. When clean, change the header key in `next.config.ts` from
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy`.

No other action is needed for the rest of SP0 (the extra headers —
`X-Powered-By` off, COOP/CORP, etc. — are already enforced and break nothing).

---

## Later phases

### SP2 — Cloudflare WAF + Bot Fight + Turnstile  *(free)*
Your DNS is already on Cloudflare, so this is all on the free plan:
- **Security → WAF →** enable the **Free Managed Ruleset**, add a **rate-limiting
  rule** on `/api/*`, `/login`, `/signup`.
- **Security → Bots → Bot Fight Mode: ON**.
- **Turnstile** (Cloudflare dash → Turnstile → add a widget) → gives a **site
  key** (public) + **secret key**. These keys enable Turnstile on signup + contact/ticket
  forms (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).

The app code now renders Turnstile on signup + support/contact forms and
verifies tokens server-side before creating accounts or tickets. If either key
is unset, verification is skipped so local development keeps working.

### SP3 — Supabase auth hardening  *(in the Supabase dashboard, free)*
- **Authentication → Providers/Policies:** enable **Leaked Password Protection**
  (HIBP), require email confirmation.
- **Authentication → Sessions:** set a sensible session timeout + refresh.
- **Auth → Rate limits / OTP:** tighten OTP expiry.

The app-side SP3 guard is already in place: `npm run security:client-env`
fails if a Client Component references a server-only env var.

### SP4 - Performance follow-up
- Marketing/static pages are already statically generated where possible.
- Recharts-heavy dashboard/time analytics surfaces are split behind lazy client
  chunks so chart libraries stay out of the initial route shell.
- Keep `force-dynamic` on authenticated dashboards, public token pages, PDFs,
  webhooks, cron, and upload routes unless a specific route is proven cacheable.

### SP5 — GitHub security automation  *(free for the repo)*
- Repo **Settings → Code security:** enable **Dependabot alerts + security
  updates**, **Secret scanning + push protection**, and add the **CodeQL**
  default workflow.

The repo now includes `.github/dependabot.yml` and
`.github/workflows/security-ci.yml`. CI runs `npm audit --audit-level=high`,
the client env audit, type-check, build, and CodeQL.

### SP6 — Uptime + cron heartbeat  *(free)*
- **UptimeRobot** (or Better Stack) → add an HTTP monitor on the app URL, and a
  **heartbeat** the `monitor` cron pings so you're alerted if crons stop.
- The `/api/cron/monitor` job already records to `cron_runs` and checks stale
  scheduled jobs. Point the external heartbeat monitor at the GitHub Actions
  cron schedule, or at the protected monitor route if your monitor supports an
  `Authorization: Bearer <CRON_SECRET>` header.

---

## Env vars summary (this initiative)

| Var | Phase | Needed |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | SP1 | **Now** (enforces rate limits) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | SP2 | Add when enabling Turnstile in prod |

No new paid spend — Upstash, Cloudflare, Turnstile, GitHub scanning, and the
uptime monitor are all free-tier for this scale.
