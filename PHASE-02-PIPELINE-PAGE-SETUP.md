# Phase 02: Pipeline Page Setup

## What Changed

- Added `/dashboard/pipeline`.
- Added Pipeline to desktop sidebar navigation.
- Added Pipeline to the mobile More menu.
- Added a pipeline board grouped by project/clientflow status.
- Added summary metrics:
  - Active work
  - Needs attention
  - Global clients
  - Open invoiced value
- Added per-card Ivo prompts for next-action guidance.
- Reused the existing project status chip, so status changes still go through the existing project workflow and history.

## Database Tasks

No new migration is required for this phase beyond Phase 01.

Make sure this migration has already been applied:

```sql
supabase/migrations/0059_clientflow_project_statuses.sql
```

## Environment Variables

No new environment variables are required.

## Third-Party Accounts

No new third-party accounts are required.

## Manual QA Checklist

- Open `/dashboard/pipeline`.
- Confirm Pipeline appears in desktop sidebar.
- Confirm Pipeline appears in mobile More navigation.
- Confirm existing projects appear under the correct lifecycle columns.
- Change a project status from the Pipeline page.
- Confirm the project moves to the correct column after refresh/state update.
- Open a project card and confirm it navigates to project detail.
- Click Ask Ivo on a card and confirm Ivo opens with project context.
- Confirm global client projects show the `Global` chip.
- Confirm invoice value appears when a project has linked invoices.

## Rollback Notes

If the Pipeline page needs to be hidden temporarily:

- Remove the Pipeline item from `src/constants/navigation.ts`.
- Remove the Pipeline item from `src/components/layout/mobile-bottom-nav.tsx`.
- Keep the route files in place; they will be unreachable from navigation but still available by URL.

