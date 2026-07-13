# Phase 09 - Automation Lite Setup

## What This Phase Adds

- Approval-first automation foundation.
- New recipe storage for user-level automation preferences.
- New suggestion storage for future persisted automation handoffs.
- Default automation recipes:
  - Overdue invoice follow-up.
  - Due-soon invoice review.
  - Proposal follow-up.
  - Unbilled time invoice.
  - Contract expiry follow-up.
- Dashboard automation suggestions powered by live workspace signals.
- Each suggestion opens Ivo with context and asks for approval before sending, creating, or changing anything.

## Required Setup

1. Apply the new migration:

   ```bash
   supabase db push
   ```

   Required SQL file for this phase:

   - `supabase/migrations/0063_automation_lite.sql`

2. No new environment variables are required.

3. No new third-party accounts are required.

## Manual QA Checklist

- Open the dashboard with no urgent work and confirm the automation card shows an empty state.
- Create or seed an overdue invoice and confirm the card suggests an invoice follow-up.
- Create or seed an invoice due in the next 3 days and confirm the card suggests a pre-due reminder.
- Create or seed a sent/viewed proposal older than 3 days and confirm the card suggests a proposal follow-up.
- Add unbilled billable time and confirm the card suggests creating an invoice.
- Create or seed a sent/viewed contract expiring within 7 days and confirm the card suggests a contract follow-up.
- Click `Ask Ivo` on each suggestion and confirm Ivo opens with the relevant context.
- Confirm no email/document/status change happens until the user explicitly approves an Ivo workflow action.

## Notes

- This phase intentionally does not run automations in the background.
- Recipes are stored now so later phases can expose per-user enable/disable controls without a schema change.
