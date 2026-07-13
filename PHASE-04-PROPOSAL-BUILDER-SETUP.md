# Phase 04 - Proposal Builder Setup

## What This Phase Adds

- Proposal builder page at `/dashboard/proposals/[id]`.
- Editable proposal metadata, scope, deliverables, timeline, terms, tax/charges.
- Package/line-item builder backed by `proposal_items`.
- Live proposal preview with totals.
- Share link action that marks the proposal as sent and opens `/p/<token>`.
- Public proposal page at `/p/<token>`.
- Public proposal view tracking with activity and notification records.

## Required Setup

1. Make sure these migrations are applied:

   ```bash
   supabase db push
   ```

   Required SQL files:

   - `supabase/migrations/0059_clientflow_project_statuses.sql`
   - `supabase/migrations/0060_proposals.sql`

2. No new environment variables are required.

3. No new third-party accounts are required.

## Manual QA Checklist

- Open `/dashboard/proposals`.
- Create a proposal and confirm it redirects to `/dashboard/proposals/[id]`.
- Add two or more line items and save.
- Refresh the page and confirm line items persist.
- Update scope, deliverables, timeline, terms, validity, currency, and tax.
- Click Share link and confirm `/p/<token>` opens publicly.
- Open the public link in a logged-out/private browser.
- Confirm proposal status moves from `sent` to `viewed` after public open.
- Confirm public proposal pages do not trigger the PWA install prompt.

## Rollback Notes

- To hide the feature without removing data, remove the Proposals navigation entry and route access.
- Existing proposal data remains in `proposals` and `proposal_items`.
- Public links are tokenized under `/p/<token>` and can be invalidated later by rotating `public_token`.

## Next Phase

Phase 05 should add conversion:

- Proposal to project.
- Proposal to contract.
- Proposal to invoice.
- Carry client, currency, package totals, scope, timeline, and terms.
