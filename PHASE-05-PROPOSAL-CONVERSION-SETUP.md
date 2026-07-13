# Phase 05 - Proposal Conversion Setup

## What This Phase Adds

- Proposal conversion tracking across:
  - `projects.proposal_id`
  - `contracts.proposal_id`
  - `invoices.proposal_id`
- Activity timeline support for proposal events.
- Builder buttons to convert a proposal into:
  - Project
  - Contract
  - Invoice
- Proposal-to-invoice uses the existing invoice creation flow, so GST, export handling, invoice numbering, FX, and invoice defaults remain centralized.
- Converted proposals are marked `converted` with `converted_at`.

## Required Setup

1. Apply the new migration after Phase 3/4 migrations:

   ```bash
   supabase db push
   ```

   Required SQL files through this phase:

   - `supabase/migrations/0059_clientflow_project_statuses.sql`
   - `supabase/migrations/0060_proposals.sql`
   - `supabase/migrations/0061_proposal_conversions.sql`

2. No new environment variables are required.

3. No new third-party accounts are required.

## Manual QA Checklist

- Open a proposal in `/dashboard/proposals/[id]`.
- Click `Project` and confirm a linked project is created/opened.
- Create another proposal and click `Contract`; confirm a draft contract is created with proposal scope/pricing.
- Create another proposal with a client and line items, click `Invoice`; confirm a draft invoice is created.
- For domestic clients, confirm the invoice uses GST rules from the existing invoice engine.
- For foreign clients, confirm the invoice is export/foreign-currency aware.
- Confirm converted proposals show status `converted`.
- Confirm proposal activity is visible where activity timelines are shown.

## Rollback Notes

- Removing the UI buttons stops new conversions.
- Existing converted documents remain usable.
- The `proposal_id` columns are nullable and can be left in place safely.

## Next Phase

Phase 06 should polish India/global intelligence across proposal creation:

- Country/currency defaults in proposals.
- Export proposal wording.
- GST-aware proposal hints.
- Better Ivo drafting prompts for domestic vs international clients.
