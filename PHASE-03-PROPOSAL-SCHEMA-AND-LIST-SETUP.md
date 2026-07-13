# Phase 03 - Proposal Schema And List Setup

## What This Phase Adds

- A dedicated `proposals` table with proposal status tracking.
- A `proposal_items` table for line-item/package storage in the next builder phase.
- RLS policies so users can only access their own proposals and proposal items.
- A new dashboard page: `/dashboard/proposals`.
- Sidebar and mobile navigation entries for Proposals.
- Basic create, edit, delete, filter, and search operations.

## Required Setup

1. Apply the Supabase migrations in order:

   ```bash
   supabase db push
   ```

   Or apply these SQL files manually in Supabase:

   - `supabase/migrations/0059_clientflow_project_statuses.sql`
   - `supabase/migrations/0060_proposals.sql`

2. If your Supabase API schema cache is stale after manual SQL execution, run:

   ```sql
   notify pgrst, 'reload schema';
   ```

3. No new environment variables or third-party accounts are required for this phase.

## QA Checklist

- Open `/dashboard/proposals`.
- Create a proposal with a title, client, project, price, and validity date.
- Confirm it appears in the list with the correct status and amount.
- Edit the proposal and change its status.
- Filter by status and search by proposal/client/project name.
- Delete a test proposal and confirm it disappears.
- Check mobile navigation More menu and FAB quick-create.

## Notes For The Next Phase

Phase 04 should build on these tables and add:

- Proposal builder sections and package options.
- Public share page.
- Client view/accept/decline flow.
- Conversion to contract and invoice.
- Ivo proposal drafting prompts.
