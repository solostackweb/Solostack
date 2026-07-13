# Phase 01: Clientflow Foundation Setup

## What Changed

- Added the master product plan in `STACKIVO_MASTER_PLAN.md`.
- Added project/clientflow statuses:
  - `proposal_sent`
  - `contract_sent`
  - `invoiced`
  - `paid`
- Updated the project status type union, server schema, and status registry.
- Added Supabase migration `0059_clientflow_project_statuses.sql`.

## Database Tasks

Run this migration in Supabase:

```sql
supabase/migrations/0059_clientflow_project_statuses.sql
```

This expands the `projects.status` check constraint and adds an index for clientflow status queries.

## Environment Variables

No new environment variables are required for this phase.

## Third-Party Accounts

No new third-party accounts are required for this phase.

## Manual QA Checklist

- Open `/dashboard/projects`.
- Create a project.
- Change its status using the project status chip.
- Confirm the new statuses appear:
  - Proposal sent
  - Contract sent
  - Invoiced
  - Paid
- Confirm the project list and Kanban view still render correctly.
- Confirm project detail status history records transitions.

## Rollback Notes

If rollback is needed, remove projects using the new statuses or move them back to older statuses first, then restore the previous `projects_status_check` constraint.

Example fallback statuses:

- `proposal_sent` -> `planning`
- `contract_sent` -> `planning`
- `invoiced` -> `completed`
- `paid` -> `completed`

