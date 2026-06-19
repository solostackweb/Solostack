# Stackivo — Admin / Founder Console Operations Runbook

How the founder console works, what each alert means, how to respond, and what
to configure. Reflects the A0–A6 hardening (scale, caching, observability,
alerting, bulk ops, rate-limiting, retention).

---

## 1. Access & security model

- **Who is admin:** any signed-in user whose email matches the `ADMIN_EMAIL`
  env var (legacy `raw_app_meta_data.role = 'admin'` is honoured as fallback).
- **MFA:** production **requires aal2** (TOTP/WebAuthn). If you hit `/admin/mfa`,
  enrol/step-up there — every other admin route redirects to it until you do.
- **Hidden surface:** non-admins get **404** (not 403) on `/admin/*`, and the
  attempt is logged as a `rls_guard_miss` security event.
- **View-as:** you can impersonate a user for read-only triage; **all writes are
  refused** while view-as is active.
- **Every write is audited** (`admin_actions`) with actor, kind, target, timing,
  success/failure — see `/admin/audit`.
- **Rate limit:** admin mutations are capped at **120/min per admin** (fails
  open if Upstash isn't configured). A breach is refused + logged as a
  `security_event` (`reason: admin_rate_limit`).

---

## 2. The pages (nav groups)

**Operate** — Now, Users, Subscriptions, Emails, Payments, Support, Notifications
**Inspect** — Invoices, Contracts, Files, Sentry, **Jobs**, Security, Audit, SQL
**Configure** — Analytics, Flags, Settings

### Now (`/admin`)
Your operating room. Reads a **cached metrics snapshot** (refreshed every monitor
run + self-heals if older than 10 min), so it's fast at any scale. Shows revenue/
pipeline/comms, the work queue, **inline reliability** (Sentry 24h errors +
unresolved, support SLA breaches, needs-reply, jobs-at-risk), integration health,
and recent audit activity. **Auto-refreshes every 60s** (pauses when tab hidden);
the "Updated …" stamp shows freshness.

### Jobs (`/admin/jobs`)  *(new)*
Health of every scheduled job from the `cron_runs` registry: last run, duration,
and **stale/failing** flags, plus a recent-runs feed. If a job goes red here, see
§4.

### Support (`/admin/support`)
First-party ticket inbox (no Crisp/Zoho). Tabs (Needs reply / Waiting / Resolved /
Delivery failures), plan + priority + SLA badges, search. Open a ticket to reply
(emails the customer), add internal notes, set status/priority/category/tags, or
insert canned responses.

### Users (`/admin/users`)
Search (trigram-indexed), filter, **multi-select bulk actions** (Export selected,
Suppress selected), and **Export CSV** of the current filter (streaming — safe for
any size). The detail page shows profile, subscription, **product footprint**
(clients/projects/invoices/contracts/welcome docs/portals/time/files/tickets),
activity/security/payment timelines, support history, churn signals, and notes.

---

## 3. Alerts (Slack) — what they mean & how to respond

The `monitor` cron (every 15 min) posts to Slack (`OPS_SLACK_WEBHOOK_URL`) and
emits a `cron_monitor_alert` security event when a probe trips:

| Alert kind | Meaning | First response |
|---|---|---|
| `billing.stale_events` | Billing webhook events unprocessed > 10 min | Check Razorpay webhook delivery + `/admin/razorpay`; replay if needed |
| `email.delivery_failures` | ≥5 failed/bounced emails in last hour | `/admin/emails?status=failed`; check Brevo status + domain auth |
| `security.alerts` | ≥3 alert-level security events in last hour | `/admin/security?severity=alert`; investigate source |
| `support.sla_breach` | Tickets past SLA with no first reply | `/admin/support?tab=needs_reply`; reply |
| `cron.unhealthy` | A scheduled job is overdue or failing | `/admin/jobs` → see §4 |

---

## 4. Cron jobs

Run via **GitHub Actions** (`.github/workflows/cron-jobs.yml`), authenticated with
`CRON_SECRET`. Each records to `cron_runs` (visible on `/admin/jobs`).

| Job | Schedule (UTC) | Purpose |
|---|---|---|
| `invoices-due-soon` | 03:00 daily | D-3/D-1 invoice reminders |
| `invoices-overdue` | 03:30 daily | Overdue reminders |
| `subscription-renewals` | 03:15 daily | Autopay D-3 renewal notice |
| `admin-export` | hourly | Off-site data export |
| `monitor` | every 15 min | Health probes + Slack alerts + metrics-cache refresh |
| `portal-digest` | Mon 04:00 | Weekly client-portal digest |
| `retention` | 04:30 daily | Prune old logs (see §6) |

**A job is red on `/admin/jobs`:**
1. Manually run it: Actions tab → "Cron jobs" → Run workflow → pick the job.
2. Read the response/error shown in the Actions log and on `/admin/jobs`.
3. Common causes: `CRON_SECRET` mismatch, `APP_URL` wrong, a deploy that failed,
   or a downstream provider (Brevo/Razorpay) error.

---

## 5. Environment variables

**Required:** `ADMIN_EMAIL`, `CRON_SECRET`, `APP_URL` (GitHub secret),
Supabase URL + service-role key.
**Observability:** `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`
(inline Sentry), `POSTHOG_DASHBOARD_URL` + `POSTHOG_FLAGS_URL` (Analytics/Flags
embeds), `OPS_SLACK_WEBHOOK_URL` (alerts).
**Hardening (optional but recommended at scale):** `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN` (enables the admin-write rate limit; fails open
without them).
**Support inbound:** `SUPPORT_INBOUND_SECRET` (see HELP_SUPPORT_SETUP_GUIDE).

---

## 6. Scale & data hygiene

- **Counts:** large list pagers use **estimated** counts (planner-based, accurate
  after autovacuum/ANALYZE); dashboard figures stay **exact** but **cached**.
- **Indexes:** trigram (search) + btree (filter/sort) on every admin-queried
  column (migration 0048). If a new admin filter/search is added, add a matching
  index.
- **Exports** stream in batches — never build the whole file in memory.
- **Retention** (daily): `delivery_logs` 180d · `cron_runs` 30d ·
  `security_events` 365d · `admin_actions` 730d. Adjust windows in
  `src/app/api/cron/retention/route.ts`.

---

## 7. Migrations to apply (this hardening)
`0048_admin_scale_indexes` · `0049_admin_metrics` · `0050_cron_runs`
(plus `0047_support_system` from the support rebuild).

## 8. Deploy checklist
1. `npm run build` locally (full tsc pass — esbuild checks here don't type-check).
2. Apply the migrations above.
3. Confirm env vars (§5).
4. Trigger `monitor` once (Actions → Run workflow) to warm the metrics cache and
   register the first `cron_runs` rows, then open `/admin` and `/admin/jobs`.
