# Phase 10: Client Portal 2.0 Setup

## What changed

- Added proposal attachments for client portals through `portal_proposals`.
- Added proposal comments inside portal document threads.
- Added a client-facing `/portal/[id]/proposals` page.
- Added proposals to the client portal navigation, home checklist, home status cards, and project documents hub.
- Kept draft proposals hidden from clients.

## Required setup

1. Apply the new Supabase migration:

   ```bash
   supabase db push
   ```

   Or run `supabase/migrations/0064_portal_proposals.sql` in the SQL editor if applying manually.

2. Confirm the existing `proposals` table has `public_token` values. The Phase 3 proposal migration creates this as a non-null default, so no manual backfill should be needed unless old data was imported manually.

3. Test as a freelancer:

   - Open a client portal in the dashboard.
   - Attach a sent/viewed/accepted proposal.
   - Confirm drafts are not available to attach.
   - Add a comment on the attached proposal.

4. Test as a client:

   - Open `/portal/[id]`.
   - Confirm the Proposals tab appears on desktop.
   - Open `/portal/[id]/proposals`.
   - Open the proposal review link.
   - Add and resolve a proposal comment.

## QA notes

- Proposal comments require the updated `portal_document_comments_doc_type_check` constraint.
- The Files page now shows project documents when a portal has proposals, invoices, contracts, or welcome docs.
- Mobile bottom navigation remains unchanged to avoid overcrowding.
