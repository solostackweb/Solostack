-- =============================================================================
-- 0074_ivo_prepared_actions.sql
--
-- The "AI-enabled workspace" flip: instead of suggesting that the user ask
-- Ivo, Stackivo prepares the actual artifact (payment reminder, lead reply,
-- proposal follow-up) in the background and queues it for one-click approval.
-- Rows are user-owned, deduped per source entity, and pruned once resolved.
-- =============================================================================

create table if not exists public.ivo_prepared_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'payment_reminder', 'due_soon_reminder', 'proposal_followup',
    'contract_followup', 'lead_reply'
  )),
  -- One prepared artifact per source moment (e.g. 'payment_reminder:<invoiceId>').
  dedupe_key text not null,
  title text not null,
  description text not null default '',
  subject text not null default '',
  body text not null,
  recipient_name text,
  recipient_email text,
  entity_type text,
  entity_id uuid,
  href text,
  tone text not null default 'info' check (tone in ('info', 'warning', 'danger')),
  status text not null default 'ready'
    check (status in ('ready', 'approved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists ivo_prepared_actions_user_ready_idx
  on public.ivo_prepared_actions (user_id, status, created_at desc);

drop trigger if exists ivo_prepared_actions_set_updated_at on public.ivo_prepared_actions;
create trigger ivo_prepared_actions_set_updated_at
before update on public.ivo_prepared_actions
for each row execute function public.set_updated_at();

alter table public.ivo_prepared_actions enable row level security;

drop policy if exists ivo_prepared_actions_owner_select on public.ivo_prepared_actions;
drop policy if exists ivo_prepared_actions_owner_insert on public.ivo_prepared_actions;
drop policy if exists ivo_prepared_actions_owner_update on public.ivo_prepared_actions;
drop policy if exists ivo_prepared_actions_owner_delete on public.ivo_prepared_actions;

create policy ivo_prepared_actions_owner_select on public.ivo_prepared_actions
  for select using (auth.uid() = user_id);
create policy ivo_prepared_actions_owner_insert on public.ivo_prepared_actions
  for insert with check (auth.uid() = user_id);
create policy ivo_prepared_actions_owner_update on public.ivo_prepared_actions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_prepared_actions_owner_delete on public.ivo_prepared_actions
  for delete using (auth.uid() = user_id);
