# Time Tracking — Production & Sell-Out Plan

**Status:** Planning (no code yet)
**Goal:** Take the Time feature from "works well" to production-ready, scalable, and a
demo-winning sell-out feature, covering all four priorities you chose: reports/analytics &
exports, entry management, billing automation & rates, and production hardening.

---

## Current state (what already works)

- **Schema** `time_entries`: `description, project_id, client_id, started_at, ended_at,
  duration_seconds, billable, hourly_rate, amount, tags, invoice_id, invoiced_at,
  created_at, updated_at`. Partial indexes for the unbilled-per-user hot path and
  `invoice_id`. `projects.hourly_rate` exists.
- **Logging:** live start/stop timer (now optimistic), manual entry, delete.
- **Server:** `listTimeEntries` (filters: project/client/from/to/billable, capped),
  `getRunningTimer`, `getTimeAggregates` (billable vs non-billable, top-5 projects),
  `getUnbilledTime` (grouped per project), `markTimeEntriesInvoiced` (atomic claim).
- **Billing link:** invoice creation pulls unbilled time → per-project line items, then
  marks those entries invoiced; deleting an invoice releases them (`ON DELETE SET NULL`).
- **UI:** dashboard (summary cards, timer, entries table, unbilled banner), client-side
  filtering over a fetched batch.

**Key gaps:** no **edit** action; filtering is client-side over a capped fetch (≤200, not
scalable); no **bulk actions**; no **exports/reports**; no **analytics charts**; rates are
per-entry only (no project/client defaults, no rounding); day-grouping isn't timezone-safe.

---

## Billing model — tracking-first, billing is opt-in per project

This is the core principle for the whole feature:

- **Time tracking is the default and always-on purpose.** You log time across projects
  purely to track it. **Billing is OFF by default.**
- **Billing is enabled per project, by the freelancer's choice.** A new project flag
  `projects.billing_enabled` (default `false`) controls whether time on that project can
  be billed. Not every project offers billable time — the freelancer opts in per project.
- **Consequences:**
  - New time entries default to **`billable = false`** (today they default to `true` —
    this flips).
  - The **"billable" toggle is only available** when the selected project has
    `billing_enabled = true`. For tracking-only projects (or no project), entries are
    non-billable and the rate field is hidden.
  - **Rates and invoicing only apply to billing-enabled projects.** Unbilled-time and
    invoice flows already key off `billable = true`, so a tracking-only project's time
    never appears in invoicing — correct by construction once defaults flip.
  - Existing projects stay tracking-only until the freelancer explicitly enables billing.

This reframes Phase 2: rate rules and invoicing are layered *on top of* the per-project
billing opt-in, not applied to all time.

---

## Phase 1 — Entry management + scalable data layer (foundation)

The base everything else builds on.

1. **Edit a time entry** — new `updateTimeEntryAction` (description, project, client,
   start, duration, billable, rate, tags) with `computeAmount` re-run; recompute on save.
   Add an edit dialog (reuse `ManualEntryDialog` in edit mode).
2. **Server-side filtering + pagination** — extend `listTimeEntries` with text search,
   tag filter, billable/invoiced status, and cursor/offset pagination + total count.
   Move the dashboard's client-side filter to server queries so it scales past 500 rows.
3. **Bulk actions** — multi-select in the entries table: bulk delete, bulk
   billable/non-billable, bulk assign project/client, bulk add tag. One server action
   taking an id list (ownership-guarded).
4. **Hardening:** enforce single running timer (exists), guard overlap/negative durations,
   timezone-correct day boundaries (store UTC, group by the user's tz), and confirm RLS +
   indexes for the new query shapes.

Touchpoints: `time/actions.ts`, `time/server.ts`, `server-schemas.ts`,
`time-entries-table.tsx`, `time-dashboard-view.tsx`, `manual-entry-dialog.tsx`.

---

## Phase 2 — Per-project billing opt-in + rate rules

Billing is layered on top of the per-project opt-in (see "Billing model" above).

1. **Per-project billing toggle** — add `projects.billing_enabled` (default `false`) +
   an optional project `hourly_rate` (already exists). Surface a "Enable time billing for
   this project" switch + rate field in the project create/edit form. Default OFF.
2. **Default entries to non-billable** — flip `billable` default to `false` in
   `manualTimeEntrySchema`, `startTimerSchema`, and the timer widget. The billable toggle
   + rate field only appear when the chosen project has `billing_enabled = true`.
3. **Rate resolution (billing-enabled projects only)** — entry rate → project
   `hourly_rate` → client default → profile default. Auto-fill when a billing-enabled
   project is picked; hidden otherwise.
4. **Client default rate** — add `clients.default_hourly_rate` + a client-form field;
   feeds rate resolution.
5. **Rounding rules** — optional per-account rounding (none / 6 / 15 / 30 min) applied to
   billable duration at invoice time; shown transparently.
6. **One-click "Invoice unbilled"** — per client, draft an invoice from that client's
   unbilled (billable, billing-enabled-project) time (reuses `getUnbilledTime` +
   `markTimeEntriesInvoiced`).
7. **Round-trip integrity** — invoiced badge + filter in the entries table, and a safe
   "unbill" while the invoice is still draft.

Touchpoints: `time/server.ts`, `invoices/actions.ts`, project form, client form,
`0042_time_billing_opt_in.sql` migration.

---

## Phase 3 — Reports, analytics & exports (the sell-out layer)

What clients see in a demo and ask to buy.

1. **Analytics dashboard** — billable vs non-billable, total billable value, by client,
   by project, by day/week trend, and utilization (billable ÷ tracked). Reuse the chart
   stack already in the app.
2. **Timesheet report** — filterable by date range + client/project, grouped by day or
   project, with totals; the view a freelancer hands a client.
3. **CSV export** — stream filtered entries to CSV (zero deps).
4. **PDF timesheet** — branded PDF via the existing `pdf` skill/route (client-ready).
5. **Per-client time summary on the portal (optional tie-in)** — you already surface
   per-project time on the client portal; this can feed a richer breakdown later.

Touchpoints: new `time/components/time-analytics.tsx`, `time/report.ts` (CSV/PDF builders),
a `/api/time/export` route, dashboard tabs.

---

## Cross-cutting hardening (woven through all phases)

- Timezone-correct aggregation; consistent rounding for `amount`.
- Pagination + indexes so the entries list and aggregates stay fast at 10k+ rows.
- Input validation (durations, dates, rate bounds) and ownership checks on every action.
- Mobile-first: timer, entry table, filters, and reports all usable on phone width.
- Each change: `tsc --noEmit` clean + 0 null-byte scan + verify at phone width.

---

## Migrations summary
- `0042_time_billing_opt_in.sql`:
  - `projects.billing_enabled boolean not null default false` — per-project billing opt-in
    (the headline change: billing is OFF by default, freelancer enables it per project).
  - `clients.default_hourly_rate` — for rate resolution.
  - optional account rounding settings on `user_profiles`
    (e.g. `time_round_minutes`, `time_round_mode`).
- (No schema change needed for Phase 1 edit/bulk — existing columns suffice.)

## Recommended build order
1. **Phase 1** (edit + server filtering/pagination + bulk) — unblocks scale & daily use.
2. **Phase 2** (rates + rounding + one-click invoicing) — billing depth.
3. **Phase 3** (analytics + exports + PDF timesheet) — the sell-out polish.

Phase 1 is the foundation; 2 and 3 layer cleanly on top. I'll build phase by phase,
pausing after each for your review.
