# Phase 11: Lead Forms Setup

## What changed

- Added owner-managed lead forms at `/dashboard/lead-forms`.
- Added public lead form links at `/lead/[slug]`.
- Public submissions now create:
  - a client record,
  - a `lead` stage project,
  - project status history,
  - a lead submission record with an Ivo follow-up prompt,
  - an in-app notification.
- Added Lead Forms to desktop and mobile navigation.

## Required setup

1. Apply the new Supabase migration:

   ```bash
   supabase db push
   ```

   Or run `supabase/migrations/0065_lead_forms.sql` manually in the Supabase SQL editor.

2. Confirm your public app URL env is correct, because form links use the same `getPublicAppUrl()` helper as invoices/contracts/proposals.

   Common variables to check:

   ```bash
   NEXT_PUBLIC_APP_URL=https://www.stackivo.me
   APP_URL=https://www.stackivo.me
   VERCEL_PROJECT_PRODUCTION_URL=www.stackivo.me
   ```

3. Create a test lead form from `/dashboard/lead-forms`.

4. Open the public form in an incognito window and submit:

   - name,
   - email,
   - country,
   - currency,
   - project brief,
   - budget/timeline.

5. Confirm the submission creates:

   - a new client,
   - a new project in Pipeline under `Lead`,
   - a recent submission on `/dashboard/lead-forms`,
   - an Ivo “Draft reply” action.

## QA notes

- Lead form pages are public, but blocked from robots indexing.
- Public submissions use the service role on the server so unauthenticated prospects can submit safely.
- Domestic leads default to INR when country is `IN`; other countries default to USD unless the prospect enters a currency.
