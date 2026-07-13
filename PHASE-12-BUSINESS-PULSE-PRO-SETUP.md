# Phase 12: Business Pulse Pro Setup

## What changed

- Added proposal performance metrics to Pulse:
  - sent,
  - accepted,
  - open,
  - win rate,
  - accepted proposal value.
- Added global revenue mix:
  - domestic paid revenue,
  - international paid revenue,
  - international revenue share,
  - country/currency breakdown.
- Added cash forecast:
  - overdue receivables,
  - due in 7 days,
  - due in 30 days,
  - projected next-30-day collections.
- Added the new metrics to the Pulse operating grid and CSV summary export.

## Required setup

No new database migration is required for this phase.

Make sure the previous proposal, invoice, client, and time tracking migrations are already applied so Pulse has complete data to read.

## Manual QA checklist

1. Open `/dashboard/pulse`.
2. Check the three new cards:
   - Proposal performance,
   - Global revenue,
   - Cash forecast.
3. Switch between 3, 6, and 12 months.
4. Apply a custom date range.
5. Confirm the cards do not stretch or break when:
   - there is no paid revenue,
   - there are many countries/currencies,
   - there are no proposals,
   - there are no open invoices.
6. Export CSV summary and verify the new metrics appear.

## Notes

- Revenue mix is shown as an INR-consolidated view, using invoice locked INR equivalents where available.
- Proposal values are based on proposal totals recorded in Stackivo.
- Public-facing behavior is unchanged; this is a Pulse Pro analytics upgrade.
