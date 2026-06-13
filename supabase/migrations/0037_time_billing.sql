-- 0037_time_billing.sql
--
-- Connects time tracking to invoicing:
--   * `time_entries.invoice_id` — set when a billable entry is pulled onto an
--     invoice. NULL = not yet billed. ON DELETE SET NULL so deleting an
--     invoice automatically releases its time entries back to "unbilled".
--   * `time_entries.invoiced_at` — audit timestamp of when it was billed.
--   * Partial index for the hot "unbilled billable time per user" query.

alter table public.time_entries
  add column if not exists invoice_id  uuid references public.invoices(id) on delete set null,
  add column if not exists invoiced_at timestamptz;

create index if not exists time_entries_unbilled_idx
  on public.time_entries (user_id, client_id)
  where invoice_id is null and billable and ended_at is not null;

create index if not exists time_entries_invoice_id_idx
  on public.time_entries (invoice_id)
  where invoice_id is not null;
