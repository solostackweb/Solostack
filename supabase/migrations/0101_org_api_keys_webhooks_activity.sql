-- =============================================================================
-- 0101_org_api_keys_webhooks_activity.sql
-- Add API keys, webhooks, and activity_events organization_id
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. API KEYS
-- =============================================================================

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_keys_organization_id_idx on public.api_keys (organization_id);
create index if not exists api_keys_key_prefix_idx on public.api_keys (key_prefix);

create trigger api_keys_set_updated_at
before update on public.api_keys
for each row execute function public.set_updated_at();

alter table public.api_keys enable row level security;

create policy api_keys_select_org on public.api_keys
  for select to authenticated
  using (public.is_org_member(organization_id, (select auth.uid())));

create policy api_keys_insert_org on public.api_keys
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[])
    and created_by = (select auth.uid())
  );

create policy api_keys_delete_org on public.api_keys
  for delete to authenticated
  using (public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[]));

grant select, insert, delete on public.api_keys to authenticated;

-- =============================================================================
-- 2. WEBHOOKS
-- =============================================================================

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'failed')),
  secret text not null,
  secret_prefix text not null,
  last_triggered_at timestamptz,
  failure_count int not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhooks_organization_id_idx on public.webhooks (organization_id);

create trigger webhooks_set_updated_at
before update on public.webhooks
for each row execute function public.set_updated_at();

alter table public.webhooks enable row level security;

create policy webhooks_select_org on public.webhooks
  for select to authenticated
  using (public.is_org_member(organization_id, (select auth.uid())));

create policy webhooks_insert_org on public.webhooks
  for insert to authenticated
  with check (
    public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[])
    and created_by = (select auth.uid())
  );

create policy webhooks_update_org on public.webhooks
  for update to authenticated
  using (public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[]));

create policy webhooks_delete_org on public.webhooks
  for delete to authenticated
  using (public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[]));

grant select, insert, update, delete on public.webhooks to authenticated;

-- =============================================================================
-- 3. ACTIVITY EVENTS - ADD ORGANIZATION_ID
-- =============================================================================

-- Add organization_id column to activity_events
alter table public.activity_events
add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists activity_events_organization_id_idx on public.activity_events (organization_id);

-- Update entity_type check constraint to include 'organization'
alter table public.activity_events
drop constraint if exists activity_events_entity_type_check;

alter table public.activity_events
add constraint activity_events_entity_type_check
check (entity_type in (
  'project',
  'client',
  'invoice',
  'contract',
  'time_entry',
  'file',
  'system',
  'recurring_invoice',
  'organization'
));

-- Update RLS policies for activity_events to use organization_id
drop policy if exists activity_events_select_own on public.activity_events;
create policy activity_events_select_org on public.activity_events
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_org_member(organization_id, (select auth.uid()))
  );

drop policy if exists activity_events_insert_own on public.activity_events;
create policy activity_events_insert_org on public.activity_events
  for insert to authenticated
  with check (
    auth.uid() = user_id
    or public.has_org_role(organization_id, (select auth.uid()), array['owner','admin']::public.org_role[])
  );

-- =============================================================================
-- 4. GRANTS
-- =============================================================================

grant select, insert on public.activity_events to authenticated;

COMMIT;