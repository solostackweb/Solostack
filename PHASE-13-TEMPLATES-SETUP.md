# Phase 13: Templates Setup

## What changed

- Added reusable `document_templates` storage.
- Added `/dashboard/templates` for user-owned templates.
- Added built-in starter templates for:
  - website proposals,
  - monthly retainer proposals,
  - export invoice notes,
  - proposal follow-up emails.
- Wired proposal templates into the proposal builder.
- Added Templates to desktop and mobile navigation.

## Required setup

Apply the new Supabase migration:

```bash
supabase db push
```

Or run `supabase/migrations/0066_document_templates.sql` manually in Supabase.

## Manual QA checklist

1. Open `/dashboard/templates`.
2. Create a proposal template.
3. Pause and reactivate it.
4. Delete a test template.
5. Open any proposal builder.
6. Apply a built-in proposal template.
7. Confirm scope, deliverables, timeline, terms, and line items update.
8. Save the proposal and confirm the values persist.

## Notes

- Existing contract built-in templates remain unchanged.
- Existing welcome document templates remain unchanged.
- Invoice note and email templates are stored now and can be wired into more send/draft surfaces in later phases.
