# Pulse Analytics — Upgrade Plan

**Status:** Planning (no code yet)
**Goal:** Take Pulse from a thin "paid-revenue + top-clients" page into a real financial
analytics product a freelancer would pay for: receivables & cash flow, a filing-ready GST
report, client/revenue analytics, time profitability — all with CSV + branded-PDF exports.

---

## Current state (what already works)

- **Server (`features/pulse/server.ts`):** `getRevenueSeries(months)` (paid totals per
  month), `getOverdueTotal()`, `getPaidInvoiceSummary()`, `getClientRevenue(limit)` (via
  the `client_revenue_summary` + `invoice_status_summary` RPCs).
- **UI (`pulse-dashboard-view.tsx`):** range tabs (3m/6m/12m), 4 KPIs (revenue,
  avg monthly, paid invoices, best client), one revenue area chart, top-clients list, and
  two **"Coming soon"** placeholder cards (expense tracking, tax estimates).
- **Gating:** whole page behind `pulse.advanced_reports` (Pro) with an `UpgradeWall`.

**Key gaps:** only counts *paid* revenue; no receivables/aging; no cash-flow or
collection metrics; no GST/tax report despite full CGST/SGST/IGST columns existing; no
profitability view despite billable `time_entries`; **no exports at all**; two dead
"coming soon" cards.

## Data we already have (no schema migration needed for v1)

- **`invoices`:** `subtotal, discount_amount, gst_amount, cgst_amount, sgst_amount,
  igst_amount, total_amount, tax_mode (non_gst|cgst_sgst|igst), classification, status
  (draft|sent|viewed|paid|overdue|partially_paid), issue_date, due_date, sent_at,
  viewed_at, paid_at, payment_method_used, client_state_code, seller_state_code`.
- **`time_entries`:** `billable, amount, duration_seconds, invoice_id, project_id,
  client_id, started_at` (Phase-3 time work).
- **`clients`, `projects`** for names + grouping.

This is enough to build everything below **without new tables**. (Expenses/net-profit is
explicitly out of scope for v1 — see "Later".)

---

## Phase 1 — Metrics engine + KPI/receivables upgrade

The foundation: one analytics service that computes everything from a single, indexed
invoice pull per range, plus the time pull. Powers KPIs, charts, and exports alike.

1. **`features/pulse/analytics.ts`** — `getPulseAnalytics({ from, to })` returning:
   - **Revenue:** paid total, MoM series, month-over-month growth %, average monthly.
   - **Receivables:** outstanding total (sent+viewed+overdue+partially_paid), overdue
     total, **AR aging buckets** (current / 1–30 / 31–60 / 61–90 / 90+ past due_date).
   - **Cash flow / collection:** average **days-to-pay** (`paid_at − issue_date`),
     collection rate (paid ÷ issued in range), count by status.
   - **Invoice funnel:** issued → viewed → paid counts + conversion %.
2. **KPI row redesign:** Revenue (range) + MoM badge, Outstanding (with overdue split),
   Avg days-to-pay, Collection rate. Keep it mobile-first (reuse the auto-fit grid).
3. **Receivables card:** aging bar/breakdown + a link to overdue invoices.

Touchpoints: new `analytics.ts`; rewrite `pulse-dashboard-view.tsx` into a client shell +
server data fetch (page passes data in, like the Time page) so charts can be interactive.

## Phase 2 — GST / tax report (filing-ready) — **GST-aware, not everyone is registered**

The headline "willing to pay" feature for Indian freelancers **who are GST-registered**.
Many freelancers/businesses are **not** — so this must degrade gracefully:

- **Registration signal:** `user_profiles.gst_registered` (+ `gstin`/`gst_number`) is the
  source of truth. Also treat "has any invoice with `tax_mode != 'non_gst'` in range" as
  evidence GST is in use.
- **If NOT GST-registered (and no GST invoices):** the GST report card/section is **hidden
  entirely** — no empty tax tables, no "₹0 tax" noise. Pulse shows only revenue,
  receivables, clients, profitability. The GST export option is also hidden.
- **If registered but a given invoice is `non_gst`:** that invoice counts toward revenue
  but is listed as **exempt/zero-rated**, never inflating tax totals.
- This `gstRegistered` flag is computed in the Phase-1 engine so every phase can branch on
  it (KPIs, GST card, exports) from one place.

1. **`getGstReport({ from, to })`** — per-period taxable value, CGST, SGST, IGST, total
   tax, grouped by **tax rate** and by **client/state** (B2B vs B2C from `classification`).
   Honors `tax_mode`; non-GST invoices shown as exempt.
2. **GST summary card + table** on Pulse — rendered **only when GST is in use**.
3. Feeds the CSV + PDF exporters in Phase 4 (GST report option hidden when not registered).

## Phase 3 — Client & revenue analytics + profitability

1. **Client analytics:** top clients by revenue (already have), **revenue concentration**
   (top-1 / top-3 share — a risk signal), **new vs returning** clients in range, revenue
   trend sparkline per top client.
2. **Revenue by project** (from invoices' `project_id`, fallback to time).
3. **Profitability (time):** billable hours tracked vs **invoiced**, unbilled value,
   effective realized rate (invoiced amount ÷ billable hours). Reuses `time_entries`.
4. Charts via the existing **recharts** stack; breakdown bars match the Time Reports tab.

## Phase 4 — Exports (CSV + branded PDF)

1. **`features/pulse/report.ts`** — zero-dep CSV builders for: financial summary,
   invoice ledger (filtered), GST report, client revenue.
2. **`documents/pdf/financial-report-pdf.tsx`** — branded PDF (same primitives as the
   invoice/timesheet PDFs): cover KPIs, revenue chart-as-table, receivables aging, GST
   summary, top clients. Brand gated by `invoices.custom_branding` like other PDFs.
3. **`/api/pulse/export` route** — `format=csv|pdf`, `report=summary|ledger|gst|clients`,
   honoring `from/to`. Streams download (mirrors `/api/time/export`).
4. **Export menu** on Pulse (CSV/PDF per report).

## Cross-cutting

- **Date range:** replace fixed 3/6/12m tabs with range presets **+ custom from/to**
  (URL-driven, like Time). Default last 6 months.
- **Performance:** single invoice query per range with only needed columns; aggregate in
  JS (counts are small per user). Promote to an RPC only if needed at scale.
- **Gating:** keep Pro gate on the page; exports inherit it. Branding gate on PDF.
- **Each phase:** null/truncation scan + cross-file contract checks + phone-width check
  (full `tsc`/`build` runs locally — sandbox OOMs on a project this size).

## Recommended build order
1. **Phase 1** (metrics engine + KPIs/receivables) — the backbone everything reuses.
2. **Phase 2** (GST report) — highest "pay-for" value, builds on the engine.
3. **Phase 3** (client/revenue/profitability) — depth + charts.
4. **Phase 4** (exports) — CSV + branded PDF over the data from 1–3.

## Later (out of scope for v1)
- Expense tracking / true net profit (needs an `expenses` table + entry UI).
- Quarterly TDS/advance-tax forecasting.
- Scheduled emailed monthly reports (could reuse the GitHub Actions cron).
- Saved custom report views.
