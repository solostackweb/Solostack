-- =============================================================================
-- 0049_admin_metrics.sql
--
-- Founder-console metrics cache (Admin hardening A1).
--
-- A single-row snapshot of the Now-page numbers (revenue / pipeline / comms /
-- support) so the dashboard reads ONE cached row instead of recomputing a
-- dozen filtered counts on every visit. Stored as JSONB so new metrics can be
-- added without a schema change.
--
-- Refreshed by the `monitor` cron (and opportunistically by the Now page when
-- the snapshot is stale). Exact numbers — cached, not estimated.
--
-- RLS enabled with NO policies → service-role only (admin path).
-- =============================================================================

create table if not exists public.admin_metrics (
  id          smallint primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  constraint admin_metrics_singleton check (id = 1)
);

-- Seed the singleton row so upserts always have a target.
insert into public.admin_metrics (id, data, computed_at)
values (1, '{}'::jsonb, now() - interval '1 day')
on conflict (id) do nothing;

alter table public.admin_metrics enable row level security;
