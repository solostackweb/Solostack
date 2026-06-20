# Stackivo — Security & Performance Hardening Plan

**Status:** In progress - SP0/SP1/SP2/SP3/SP5 code shipped; SP4 started; dashboard setup remains.
**Goal:** Make the app production-secure and fast for the first ~1,000 users, focused on **application code + external tooling** (not DB sizing/RAM — that's a later, separate effort). Where a gap needs a tool, use one with a **generous free tier**.

---

## 1. Current posture (already solid — don't rebuild)

- **Middleware:** Supabase session refresh, public/protected/auth-only route model, admin gate (non-admins → 404 cloak), client-portal redirect, `x-request-id` + `x-pathname` correlation.
- **Headers (next.config):** HSTS (preload), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection: 0`.
- **Webhooks:** Razorpay + Brevo **signature-verified**, invalid → `security_events` alert.
- **Rate limiting (Upstash):** auth, signup, password-reset, public-sign, share-view, email-send, admin-write.
- **AuthZ:** RLS throughout, service-role isolation, **MFA/aal2 for admin**, view-as write-refusal, audited admin writes.
- **Observability:** Sentry (client/server/edge), PostHog, Microsoft Clarity, Slack ops alerts, `security_events` + `admin_actions`.
- **Validation:** Zod on server actions.

## 2. Gaps (this plan)

| # | Gap | Risk |
|---|---|---|
| 1 | **No Content-Security-Policy** | XSS has no containment layer |
| 2 | Rate-limit holes: guest ticket/contact create, push subscribe, portal presign/commit, any unauth POST | Spam / resource abuse |
| 3 | No bot/CAPTCHA on signup + public forms | Automated abuse, fake accounts |
| 4 | No edge WAF / bot-fight (Cloudflare free, unused) | Volumetric abuse hits the app directly |
| 5 | `X-Powered-By` exposed; no COOP/CORP | Info leak; weaker isolation |
| 6 | No CI dependency/secret/SAST scanning | Vulns + leaked secrets ship silently |
| 7 | `force-dynamic` overuse; heavy client libs not lazy-loaded | Slow TTFB, large bundles |
| 8 | Supabase leaked-password / OTP / session settings not hardened | Credential-stuffing, long-lived sessions |

---

## 3. Recommended tools (all free-tier-friendly)

| Tool | Use | Free tier |
|---|---|---|
| **Cloudflare** (already your DNS) | Proxy → **WAF managed rules**, **rate-limiting rules**, **Bot Fight Mode**, CDN cache | Free plan covers all of these |
| **Cloudflare Turnstile** | CAPTCHA on signup + contact/ticket forms | Free, unlimited |
| **GitHub Dependabot + Secret Scanning + CodeQL** | Dependency vulns, leaked secrets, SAST in CI | Free for the repo |
| **Upstash Redis** | Rate-limit backing store | **Free forever: 500K commands/month + 256 MB** — ample for 1,000 users. **Not yet provisioned** — see setup doc. Until configured, all rate limiters **fail open** (no protection), so this is a required step for SP1 to actually enforce. |
| **Sentry** (already) | Errors + perf traces | Existing |
| **UptimeRobot / Better Stack** | Uptime + cron heartbeat monitoring | Free tier (50 monitors) |

No new paid spend required to reach 1,000 users safely.

---

## 4. Phases

### SP0 — Headers & quick wins *(code, low risk, high value)*
- Add a **Content-Security-Policy** — start `Content-Security-Policy-Report-Only` (nonce-based via middleware) to catch violations without breaking anything, then flip to enforced. Allowlist: self, Supabase, Sentry, PostHog, Clarity, Razorpay, Cloudflare, fonts.
- `poweredByHeader: false`; add `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, tighten `Permissions-Policy`.
- Request **body-size limits** on API routes that accept input (DoS guard).
- Ensure error responses never leak stack traces to the client.

### SP1 — Rate-limit coverage *(code)*
- Add IP (and where logged-in, per-user) limits to every public/abuse endpoint missing one: **guest ticket + contact create**, push subscribe/unsubscribe, portal presign/commit, any unauthenticated POST. Reuse the Upstash limiter; add a couple of new limiter configs.
- Standardise: a small helper to gate a route by IP in one line.
- **Depends on Upstash being provisioned** (free tier — see setup doc). The code ships now and is safe (fails open) before Upstash exists; it starts enforcing the moment the two env vars are set.

### SP2 — Bot & abuse protection *(tool + code)*
- **Cloudflare Turnstile** on signup, the marketing `/contact` form, and the support ticket form; verify the token server-side before creating the account/ticket.
- **Cloudflare dashboard:** enable proxy (orange-cloud), **Bot Fight Mode**, a **WAF rate-limiting rule** on `/api/*` and `/login`/`/signup`, and the free **OWASP managed ruleset**.

### SP3 — Auth & secret hardening *(tool + code)*
- Supabase Auth: enable **leaked-password protection** (HIBP), set sensible **OTP expiry** + **session/refresh** lifetimes, confirm email-confirm required.
- Verify **no secret reaches the client bundle** (only `NEXT_PUBLIC_*` public values); audit `env.ts`.
- CAPTCHA gate on auth (ties to SP2).

### SP4 — Performance *(code + edge)*
- Audit and remove unnecessary **`force-dynamic`**; add caching / ISR (`revalidate`) to marketing + static pages so they're CDN-served, not SSR'd per request.
- **Lazy-load heavy client libs** (recharts, framer-motion, three.js, @react-pdf) via dynamic import so they're off the initial bundle.
- Narrow DB `select()`s + confirm no N+1 on hot paths (admin already indexed in A0).
- Add safe `Cache-Control` to cacheable API responses; let Cloudflare cache static assets.

### SP5 — CI security automation *(tool)*
- Enable **Dependabot** (deps + GitHub Actions), **Secret Scanning + push protection**, and **CodeQL** workflow.
- Add a CI step: `npm audit --audit-level=high` + `npm run build` gate on PRs.

### SP6 — Uptime & alerting *(tool)*
- **UptimeRobot/Better Stack** monitors on the app + a **heartbeat** for the monitor cron (alerts if crons stop). Review Sentry alert rules.

### SP7 — Verify + docs
- Re-verify headers (securityheaders.com / Mozilla Observatory), CSP enforced with no violations, rate-limits trip correctly, Turnstile blocks bots.
- Write **`SECURITY.md`** (responsible disclosure) + an incident-response section in the ops runbook + an OWASP-style review checklist.

---

## 5. Cross-cutting principles
- **Defence in depth:** edge (Cloudflare WAF/bot) → app (rate-limit, validation, CSP) → data (RLS, service-role isolation).
- **Fail closed** on auth; **fail open** on non-critical limiters (already the pattern).
- **No secret in the client**; everything sensitive behind server actions / service role.
- Reuse existing infra (Upstash, Sentry, Cloudflare, GitHub) — **₹0 new spend** to 1,000 users.

## 6. Recommended order
**SP0 → SP1 → SP2 → SP3 → SP4 → SP5 → SP6 → SP7.** SP0 + SP1 are pure code (immediate hardening); SP2/SP3/SP5/SP6 pair code with a one-time dashboard setup I'll give you steps for.
