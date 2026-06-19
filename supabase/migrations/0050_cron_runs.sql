-- =============================================================================
-- 0050_cron_runs.sql
--
-- Cron-run registry (Admin hardening A3).
--
-- Every scheduled job (invoices-due-soon, invoices-overdue, subscription-
-- renewals, admin-export, monitor, portal-digest) writes one row per run so
-- the founder console can show last-run / status / duration and alert on
-- silent failures or stale jobs.
--
-- Service-role only (RLS enabled, no policies).
-- =============================================================================

create table if not exists public.cron_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,
  status      text not null default 'ok' check (status in ('ok', 'error')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  duration_ms integer not null default 0,
  detail      jsonb not null default '{}'::jsonb,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists cron_runs_job_created_idx
  on public.cron_runs (job, created_at desc);

create index if not exists cron_runs_created_idx
  on public.cron_runs (created_at desc);

alter table public.cron_runs enable row level security;
