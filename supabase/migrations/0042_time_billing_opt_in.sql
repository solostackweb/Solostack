-- =============================================================================
-- 0042_time_billing_opt_in.sql
-- Per-project billing opt-in. Billing is OFF by default; the freelancer turns
-- it on per project. `hourly_rate` is the project's default billable rate.
-- Idempotent.
-- =============================================================================

alter table public.projects
  add column if not exists billing_enabled boolean       not null default false,
  add column if not exists hourly_rate     numeric(12,2) not null default 0;
