# Stackivo — Admin Panel (Founder Console) Hardening Plan

**Status:** Planning (no code yet)
**Goal:** Take the founder console from "works for hundreds of users" to **production-grade and scalable to thousands → millions of users**: fast at scale, observable (Sentry · PostHog · Slack surfaced *inline*, not just linked), proactive (alerts + cron health), operationally powerful (bulk actions), and fully in sync with every recent product change (first-party support, time/pulse, billing autopay, welcome docs).

---

## 1. Current state (what's already strong)

- **Security (excellent):** env-gated admin (`ADMIN_EMAIL`), **MFA/aal2 enforced in production**, "view-as" with write-refusal (`assertNotViewAs`), 404-not-403 surface hiding, every write wrapped in `runAdminAction()` with audit + timing, `recordSecurityEvent` forensics.
- **Structure:** 24 pages in 3 nav groups (Operate / Inspect / Configure) under `AdminShell` with a command palette.
- **Data layer (`features/admin/queries.ts`):** list endpoints paginate via `.range()`; snapshots use `head:true` counts; the Now page composes 6 snapshots in parallel.
- **Observability:** Sentry (live REST API + deep links), PostHog (iframe dashboards + flags), Slack ops alerts via the `monitor` cron, Brevo/Razorpay/Sentry status pills.
- **Ops:** SQL runner, broadcast/notifications, suppression management, audit + security-event logs, admin notes, receipts.

## 2. Gaps that block scale (the focus of this plan)

| # | Gap | Impact at scale |
|---|---|---|
| 1 | `count:"exact"` on every list + snapshot (26×) | Full-table counts → multi-second admin pages past ~50k rows |
| 2 | No trigram indexes for admin `ilike '%term%'` search (users, emails, invoices, contracts, files) | Search does sequential scans; slow + DB load |
| 3 | No caching (no `unstable_cache`, no metrics table) | Now page + list headers recompute counts every visit |
| 4 | `.limit(10_000)` on Files query | Unbounded fetch; memory + latency blow-up |
| 5 | No cron-job health surface | monitor / renewals / reminders run blind; silent failures |
| 6 | Observability is link-out only | Error rate / event volume / cron status not visible inline; alerting limited to 3 probes |
| 7 | No bulk actions, no auto-refresh on Now | Slow founder ops as volume grows |

## 3. Target architecture

- **Counts:** exact only where cardinality is small; **estimated/planned counts** (or cached metrics) for large tables. Never block a page on a full-table `count`.
- **Indexes:** btree on every admin filter/sort column (`status`, `created_at`, `plan`, `user_id`); **`pg_trgm` GIN** on every searched text column.
- **Metrics cache:** an `admin_metrics` snapshot table refreshed by the existing GitHub-Actions cron (single cheap read for the Now page), plus short-TTL `unstable_cache` for sub-views.
- **Observability inline:** Now page pulls Sentry (24h error count / new issues), cron-job health (last run + status), support SLA breaches, email failure rate — with deep links retained.
- **Proactive alerting:** expand `monitor` probes + a cron-run registry; route by severity to Slack; emit security events for audit.
- **Operational power:** multi-select bulk actions (audited), saved filters, streaming CSV export, richer command palette.
- **Reliability/security:** admin-action rate limiting, retention/cleanup jobs, least-privilege review of service-role reads, cursor pagination for deep lists.

---

## 4. Phases

### A0 — Scale foundations (DB) *(biggest win, lowest risk)*
- Migration: **`pg_trgm` GIN indexes** on `user_profiles(email, full_name)`, `delivery_logs(to_email, subject)`, `invoices(invoice_number)`, `contracts(title)`, storage/file name columns; **btree** on the status/created_at/plan/user_id columns admin lists filter & sort by.
- Replace blocking `count:"exact"` on large tables with **estimated counts** (Postgres `reltuples` via a small RPC) or "count up to N then show N+"; keep exact for small tables (subscriptions, security events).
- Fix the Files `.limit(10_000)` → real pagination.
- Verify: `explain analyze` the hot list queries; esbuild + null scan.

### A1 — Metrics cache layer
- `admin_metrics` table (one row per metric/day) refreshed by a new step in the `monitor` cron (or a dedicated cron). Now-page snapshots read the cache (one query) and fall back to live compute if stale.
- Wrap sub-view aggregates in `unstable_cache` with a short TTL + tag-based revalidation on relevant writes.
- Verify: Now page issues ≤ a couple of queries; numbers match live within the TTL window.

### A2 — Now page = real operating room
- Inline **Sentry** (24h errors / new issues / release health) via the existing `sentry-api` lib.
- Inline **cron-job health** (last run, ok/fail, last error) from the A3 registry.
- Inline **support SLA breaches**, email-failure rate, trialing-ending, past-due — all from the cache.
- Optional **auto-refresh** (poll every N seconds) and a "last updated" stamp.
- Verify: contracts + mobile + null scan.

### A3 — Observability & proactive alerting depth
- **Cron-run registry**: a `cron_runs` table every scheduled job writes to (job, started/finished, status, error, counts); an `/admin/jobs` page listing recent runs + a stale-job alert.
- Expand `monitor` probes: **SLA breaches**, **signup drop / churn spike**, **payment-failure rate**, **webhook backlog**, plus the existing three — with tuned thresholds.
- Slack routing by severity (warn vs page) and dedupe; every alert still emits a security event.
- Verify: simulate each probe; confirm Slack + security-event + audit.

### A4 — Operational power (bulk + ergonomics)
- **Multi-select bulk actions** (users: suppress/export/view; invoices/emails: resend/export) — all through `runAdminAction` (audited) with a typed-confirm guard for destructive ops.
- **Saved filters** + shareable querystrings on every list.
- **Streaming CSV export** for large result sets (no full in-memory build).
- Command palette: jump-to-entity by id/email, run common actions.
- Verify: audit entries for bulk ops; export memory profile.

### A5 — Correspondence pass (sync admin with the whole product)
- Confirm every surface reflects current systems: **first-party support** (done in S-series — verify deep links + counts), **time/pulse**, **billing autopay** (mandate state, next-charge, renewals), **welcome docs**, **portals activity**, **referrals**.
- Add any missing admin views: **AI assistant usage**, **portal/chat activity**, **subscription lifecycle timeline**.
- Remove any remaining legacy references (e.g. ensure nothing reads the deprecated `support_threads`).
- Verify: click every nav item against seeded data.

### A6 — Reliability & security hardening
- **Rate-limit** admin write actions (per-admin, per-action) via the existing Upstash limiter.
- **Retention/cleanup** jobs for `delivery_logs`, `security_events`, `admin_actions`, `cron_runs` (partition or periodic prune) so tables stay fast.
- Review service-role read **blast radius**; tighten columns selected; add cursor pagination for the deepest lists (audit/security/emails).
- Load-test the 3 heaviest pages with synthetic volume.
- Verify: prune dry-run, rate-limit trip test, `explain` after retention.

### A7 — Final verification + runbook
- Full esbuild bundle (warning level) across admin entrypoints, null scan, RLS spot-checks, mobile.
- `ADMIN_OPERATIONS_RUNBOOK.md`: what each page/alert means, how to respond, env vars (Sentry/PostHog/Slack/Upstash), cron schedule, escalation.

---

## 5. Cross-cutting principles
- **Never block a page on an exact full-table count** — cache or estimate.
- **Index every column an admin filters, sorts, or searches.**
- **Everything observable**: inline health on Now; every job in the registry; every alert audited.
- **Every write audited** (already true) and **rate-limited** (new).
- Reuse existing infra (Upstash limiter, GitHub-Actions cron, Sentry/PostHog/Slack) — no new vendors, no new cost.

## 6. Recommended order
**A0 → A1 → A2 → A3 → A4 → A5 → A6 → A7.** A0 (indexes + estimated counts) is the highest-leverage, lowest-risk win and unblocks everything after it.
