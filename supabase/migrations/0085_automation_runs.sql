-- =============================================================================
-- 0085_automation_runs.sql
--
-- Durable automation runs — Phase 4 slice 1.
--
-- The dashboard has computed "automation suggestions" ephemerally for every
-- render. This table makes the evaluator's decisions durable: one row per
-- distinct detected moment (source entity + trigger), transitioned through the
-- roadmap lifecycle (queued -> running -> waiting_for_approval -> succeeded,
-- or failed/cancelled) by the slice-2 scheduled executor. Repeated evaluations
-- of the same moment must not create duplicate rows, so dedupe_key is unique
-- per user and trigger.
--
-- Rows are user-owned (RLS), deduped per moment, and carry an audit-friendly
-- inputs/results/error trail. Service-role independent; the app writes through
-- the normal user-session policies.
-- =============================================================================

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.automation_recipes(id) on delete set null,
  trigger_key text not null,
  -- One run per source moment (e.g. 'invoice_overdue_followup:<invoiceId>').
  dedupe_key text,
  status text not null default 'queued'
    check (status in (
      'queued', 'running', 'waiting_for_approval',
      'succeeded', 'failed', 'cancelled'
    )),
  entity_type text,
  entity_id uuid,
  reason text not null default '',
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  error text,
  retry_count integer not null default 0,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A moment may only have one live decided run: unique across user + trigger +
-- dedupe key. Resolved runs (succeeded/failed/cancelled) can re-trigger later.
create unique index if not exists automation_runs_user_dedupe_key_idx
  on public.automation_runs (user_id, trigger_key, dedupe_key)
  where dedupe_key is not null;

create index if not exists automation_runs_user_status_idx
  on public.automation_runs (user_id, status, created_at desc);

create index if not exists automation_runs_entity_idx
  on public.automation_runs (entity_type, entity_id);

create index if not exists automation_runs_recipe_idx
  on public.automation_runs (recipe_id);

drop trigger if exists automation_runs_set_updated_at on public.automation_runs;
create trigger automation_runs_set_updated_at
before update on public.automation_runs
for each row execute function public.set_updated_at();

alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_owner_select on public.automation_runs;
drop policy if exists automation_runs_owner_insert on public.automation_runs;
drop policy if exists automation_runs_owner_update on public.automation_runs;
drop policy if exists automation_runs_owner_delete on public.automation_runs;

create policy automation_runs_owner_select on public.automation_runs
  for select using (auth.uid() = user_id);
create policy automation_runs_owner_insert on public.automation_runs
  for insert with check (auth.uid() = user_id);
create policy automation_runs_owner_update on public.automation_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy automation_runs_owner_delete on public.automation_runs
  for delete using (auth.uid() = user_id);