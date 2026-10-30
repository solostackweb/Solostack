-- =============================================================================
-- 0098_organizations.sql
--
-- Organizations / Teams support
-- =============================================================================

-- =============================================================================
-- organizations
-- =============================================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  brand_color text,
  brand_tagline text,
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists organizations_owner_user_id_idx on public.organizations (owner_user_id);
create index if not exists organizations_slug_idx on public.organizations (slug) where deleted_at is null;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- =============================================================================
-- organization_members
-- =============================================================================
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  cost_rate numeric(12,2) default 0,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_organization_id_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_id_idx on public.organization_members (user_id);
create index if not exists organization_members_joined_idx on public.organization_members (organization_id, user_id) where joined_at is not null and revoked_at is null;

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

-- =============================================================================
-- organization_invitations
-- =============================================================================
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null default 'member',
  token_hash text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, email, accepted_at) where accepted_at is null
);

create index if not exists organization_invitations_organization_id_idx on public.organization_invitations (organization_id);
create index if not exists organization_invitations_token_hash_idx on public.organization_invitations (token_hash);

-- =============================================================================
-- portals: add organization_id (nullable for legacy)
-- =============================================================================
alter table public.portals
add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists portals_organization_id_idx on public.portals (organization_id);

-- =============================================================================
-- project_members (for collaborators feature)
-- =============================================================================
create type public.project_member_role as enum ('lead', 'member', 'viewer');

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.project_member_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_id_idx on public.project_members (project_id);
create index if not exists project_members_user_id_idx on public.project_members (user_id);
create index if not exists project_members_joined_idx on public.project_members (project_id, user_id) where joined_at is not null and revoked_at is null;

create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

-- =============================================================================
-- project_costs (for profitability tracking)
-- =============================================================================
create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  description text,
  amount numeric(12,2) not null,
  currency text not null default 'INR',
  cost_date timestamptz not null default now(),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_costs_project_id_idx on public.project_costs (project_id);
create index if not exists project_costs_user_id_idx on public.project_costs (user_id);
create index if not exists project_costs_cost_date_idx on public.project_costs (cost_date);

create trigger project_costs_set_updated_at
before update on public.project_costs
for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- organizations: owner + admins can manage, members can read
alter table public.organizations enable row level security;

create policy organizations_select_member
on public.organizations
for select
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

create policy organizations_insert_owner
on public.organizations
for insert
with check (owner_user_id = auth.uid());

create policy organizations_update_admin
on public.organizations
for update
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

create policy organizations_delete_owner
on public.organizations
for delete
using (owner_user_id = auth.uid());

-- organization_members: owners/admins can manage, members can read their org's members
alter table public.organization_members enable row level security;

create policy organization_members_select
on public.organization_members
for select
using (
  exists (
    select 1 from public.organization_members om2
    where om2.organization_id = organization_members.organization_id
      and om2.user_id = auth.uid()
      and om2.joined_at is not null
      and om2.revoked_at is null
  )
);

create policy organization_members_insert_admin
on public.organization_members
for insert
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

create policy organization_members_update_admin
on public.organization_members
for update
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

create policy organization_members_delete_admin
on public.organization_members
for delete
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

-- organization_invitations: invited user + org admins can read
alter table public.organization_invitations enable row level security;

create policy organization_invitations_select_invitee
on public.organization_invitations
for select
using (
  email = (select email from auth.users where id = auth.uid())
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

create policy organization_invitations_insert_admin
on public.organization_invitations
for insert
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_invitations.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
      and om.joined_at is not null
      and om.revoked_at is null
  )
);

-- project_members: project owner + org admins can manage, members can read
alter table public.project_members enable row level security;

create policy project_members_select
on public.project_members
for select
using (
  -- project owner can see all members
  exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  or
  -- project member can see other members
  exists (
    select 1 from public.project_members pm2
    where pm2.project_id = project_members.project_id
      and pm2.user_id = auth.uid()
      and pm2.joined_at is not null
      and pm2.revoked_at is null
  )
);

create policy project_members_insert_owner
on public.project_members
for insert
with check (
  exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
);

create policy project_members_update_owner
on public.project_members
for update
using (
  exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
);

create policy project_members_delete_owner
on public.project_members
for delete
using (
  exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
);

-- =============================================================================
-- project_costs RLS (project owner can manage costs)
-- =============================================================================
alter table public.project_costs enable row level security;

create policy project_costs_select
on public.project_costs
for select
using (
  exists (select 1 from public.projects p where p.id = project_costs.project_id and p.user_id = auth.uid())
  or
  exists (
    select 1 from public.project_costs pc2
    where pc2.project_id = project_costs.project_id
      and pc2.user_id = auth.uid()
  )
);

create policy project_costs_insert_owner
on public.project_costs
for insert
with check (
  exists (select 1 from public.projects p where p.id = project_costs.project_id and p.user_id = auth.uid())
);

create policy project_costs_update_owner
on public.project_costs
for update
using (
  exists (select 1 from public.projects p where p.id = project_costs.project_id and p.user_id = auth.uid())
);

create policy project_costs_delete_owner
on public.project_costs
for delete
using (
  exists (select 1 from public.projects p where p.id = project_costs.project_id and p.user_id = auth.uid())
);

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Check if user is org member (active)
create or replace function public.is_org_member(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and joined_at is not null
      and revoked_at is null
  );
$$;

-- Check if user has org role (owner/admin)
create or replace function public.has_org_role(p_org_id uuid, p_user_id uuid, p_roles public.org_role[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and joined_at is not null
      and revoked_at is null
      and role = any(p_roles)
  );
$$;

-- Check if user is project member (active)
create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = p_user_id
      and joined_at is not null
      and revoked_at is null
  );
$$;

-- Keep activity tracking aligned with the entity types emitted by the app.
alter table public.activity_events
  drop constraint if exists activity_events_entity_type_check;

alter table public.activity_events
  add constraint activity_events_entity_type_check
  check (entity_type in (
    'project',
    'client',
    'proposal',
    'invoice',
    'contract',
    'welcome_document',
    'time_entry',
    'file',
    'system',
    'recurring_invoice',
    'organization'
  ));

-- =============================================================================
-- Auto-create personal org on user signup (via trigger)
-- =============================================================================

create or replace function public.create_personal_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_slug text;
begin
  -- Generate unique slug from user's name/email
  v_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '^-+|-+$', '');
  if v_slug = '' then
    v_slug := 'user-' || substr(new.id::text, 1, 8);
  end if;

  -- Ensure uniqueness
  v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  insert into public.organizations (id, name, slug, owner_user_id)
  values (gen_random_uuid(), new.raw_user_meta_data->>'full_name' || '''s Organization', v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role, joined_at)
  values (v_org_id, new.id, 'owner', now());

  return new;
end;
$$;

-- Attach to auth.users insert (via trigger on user_profiles creation)
-- Note: We already have on_user_profile_created trigger, so we'll add this there
-- or create a separate trigger on auth.users if preferred.
