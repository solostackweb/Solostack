# Phase 13: Templates Setup

## What changed

- Upgraded `/dashboard/templates` into a reusable document template workspace.
- Added shared template support for:
  - proposals,
  - contracts,
  - welcome documents.
- Added richer built-in starter templates for proposals, contracts, and welcome docs.
- Saved contract templates now appear in the new contract flow.
- Saved welcome document templates now appear in the welcome document template picker.
- Proposal templates continue to feed the proposal builder.
- Legacy invoice note and email template storage remains supported for existing data.

## Required setup

Apply the Supabase migrations:

```bash
supabase db push
```

Or run these manually in Supabase, in order:

1. `supabase/migrations/0066_document_templates.sql`
2. `supabase/migrations/0067_document_templates_welcome_docs.sql`

## Manual QA checklist

1. Open `/dashboard/templates`.
2. Create a proposal template and confirm it appears on `/dashboard/proposals/new`.
3. Create a contract template with sections and confirm it appears on `/dashboard/contracts/new`.
4. Create a welcome doc template and confirm it appears on `/dashboard/welcome/new`.
5. Pause and reactivate a saved template.
6. Delete a test template.
7. Confirm built-in templates still appear for proposals, contracts, and welcome docs.
8. Create one document from each template type and confirm the copied content is editable.

## Notes

- Existing legacy welcome document templates remain readable.
- Existing invoice note and email templates remain stored, but the main product-facing template workspace now focuses on proposals, contracts, and welcome docs.
- Templates are still starting points. Users should review placeholders before sending contracts or sharing documents.
