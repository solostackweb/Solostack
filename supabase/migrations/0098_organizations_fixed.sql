-- =============================================================================
-- 0098_organizations.sql
-- Organizations / Teams support
-- Supabase / PostgreSQL
--
-- Rerun-compatible migration:
--   * enums are created only when missing
--   * tables and indexes use IF NOT EXISTS
--   * triggers and policies are dropped before recreation
--   * functions use CREATE OR REPLACE
--   * pending invitations are protected by a partial unique index
--   * organization_members RLS avoids recursive policy evaluation
--
-- Assumptions inherited from the original migration:
--   * public.set_updated_at() already exists
--   * public.portals and public.projects already exist
--   * public.projects has a user_id owner column
--   * Supabase auth.users / auth.uid() are available
-- =============================================================================

begin;

-- =============================================================================
-- 1. ENUM TYPES (idempotent)
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'org_role'
  ) then
    create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_member_role'
  ) then
    create type public.project_member_role as enum ('lead', 'member', 'viewer');
  end if;
end
$$;

-- =============================================================================
-- 2. ORGANIZATIONS
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

create index if not exists organizations_owner_user_id_idx
  on public.organizations (owner_user_id);

create index if not exists organizations_slug_idx
  on public.organizations (slug)
  where deleted_at is null;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. ORGANIZATION MEMBERS
-- =============================================================================

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

create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists organization_members_joined_idx
  on public.organization_members (organization_id, user_id)
  where joined_at is not null and revoked_at is null;

drop trigger if exists organization_members_set_updated_at
  on public.organization_members;
create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

-- =============================================================================
-- 4. ORGANIZATION INVITATIONS
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
  created_at timestamptz not null default now()
);

create index if not exists organization_invitations_organization_id_idx
  on public.organization_invitations (organization_id);

create index if not exists organization_invitations_token_hash_idx
  on public.organization_invitations (token_hash);

-- Only one pending invitation per organization/email.
-- Accepted invitations do not prevent a future invitation.
-- lower(email) makes the uniqueness check case-insensitive.
create unique index if not exists organization_invitations_unique_pending_idx
  on public.organization_invitations (organization_id, lower(email))
  where accepted_at is null;

-- =============================================================================
-- 5. PORTALS: ORGANIZATION LINK
-- =============================================================================

alter table public.portals
  add column if not exists organization_id uuid
  references public.organizations(id) on delete set null;

create index if not exists portals_organization_id_idx
  on public.portals (organization_id);

-- =============================================================================
-- 6. PROJECT MEMBERS
-- =============================================================================

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

create index if not exists project_members_project_id_idx
  on public.project_members (project_id);

create index if not exists project_members_user_id_idx
  on public.project_members (user_id);

create index if not exists project_members_joined_idx
  on public.project_members (project_id, user_id)
  where joined_at is not null and revoked_at is null;

drop trigger if exists project_members_set_updated_at on public.project_members;
create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function public.set_updated_at();

-- =============================================================================
-- 7. PROJECT COSTS
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

create index if not exists project_costs_project_id_idx
  on public.project_costs (project_id);

create index if not exists project_costs_user_id_idx
  on public.project_costs (user_id);

create index if not exists project_costs_cost_date_idx
  on public.project_costs (cost_date);

drop trigger if exists project_costs_set_updated_at on public.project_costs;
create trigger project_costs_set_updated_at
before update on public.project_costs
for each row execute function public.set_updated_at();

-- =============================================================================
-- 8. SECURITY-DEFINER HELPER FUNCTIONS
--
-- These functions avoid querying organization_members from a policy on
-- organization_members itself, which otherwise can cause infinite RLS
-- recursion (SQLSTATE 42P17).
-- =============================================================================

create or replace function public.is_org_member(
  p_org_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = p_user_id
      and om.joined_at is not null
      and om.revoked_at is null
  );
$$;

create or replace function public.has_org_role(
  p_org_id uuid,
  p_user_id uuid,
  p_roles public.org_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = p_user_id
      and om.joined_at is not null
      and om.revoked_at is null
      and om.role = any(p_roles)
  );
$$;

create or replace function public.is_project_member(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = p_user_id
      and pm.joined_at is not null
      and pm.revoked_at is null
  );
$$;

-- Preserve the original project-cost visibility rule without querying
-- project_costs recursively from its own RLS policy.
create or replace function public.can_view_project_costs(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and p.user_id = p_user_id
    )
    or exists (
      select 1
      from public.project_costs pc
      where pc.project_id = p_project_id
        and pc.user_id = p_user_id
    );
$$;

-- Keep helper functions callable by authenticated API users.
grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.has_org_role(uuid, uuid, public.org_role[]) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.can_view_project_costs(uuid, uuid) to authenticated;

-- =============================================================================
-- 9. ENABLE RLS
-- =============================================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.project_members enable row level security;
alter table public.project_costs enable row level security;

-- =============================================================================
-- 10. ORGANIZATIONS POLICIES
-- =============================================================================

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
on public.organizations
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or public.is_org_member(id, (select auth.uid()))
);

drop policy if exists organizations_insert_owner on public.organizations;
create policy organizations_insert_owner
on public.organizations
for insert
to authenticated
with check (owner_user_id = (select auth.uid()));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin
on public.organizations
for update
to authenticated
using (
  public.has_org_role(
    id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
)
with check (
  public.has_org_role(
    id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
);

drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

-- =============================================================================
-- 11. ORGANIZATION MEMBERS POLICIES
-- =============================================================================

drop policy if exists organization_members_select on public.organization_members;
create policy organization_members_select
on public.organization_members
for select
to authenticated
using (
  public.is_org_member(organization_id, (select auth.uid()))
);

drop policy if exists organization_members_insert_admin on public.organization_members;
create policy organization_members_insert_admin
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
);

drop policy if exists organization_members_update_admin on public.organization_members;
create policy organization_members_update_admin
on public.organization_members
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
);

drop policy if exists organization_members_delete_admin on public.organization_members;
create policy organization_members_delete_admin
on public.organization_members
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
);

-- =============================================================================
-- 12. ORGANIZATION INVITATIONS POLICIES
-- =============================================================================

drop policy if exists organization_invitations_select_invitee
  on public.organization_invitations;
create policy organization_invitations_select_invitee
on public.organization_invitations
for select
to authenticated
using (
  lower(email) = lower(
    coalesce(
      (select u.email from auth.users u where u.id = (select auth.uid())),
      ''
    )
  )
  or public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
);

drop policy if exists organization_invitations_insert_admin
  on public.organization_invitations;
create policy organization_invitations_insert_admin
on public.organization_invitations
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    (select auth.uid()),
    array['owner', 'admin']::public.org_role[]
  )
  and invited_by = (select auth.uid())
);

-- =============================================================================
-- 13. PROJECT MEMBERS POLICIES
-- =============================================================================

drop policy if exists project_members_select on public.project_members;
create policy project_members_select
on public.project_members
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  )
  or public.is_project_member(project_id, (select auth.uid()))
);

drop policy if exists project_members_insert_owner on public.project_members;
create policy project_members_insert_owner
on public.project_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists project_members_update_owner on public.project_members;
create policy project_members_update_owner
on public.project_members
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists project_members_delete_owner on public.project_members;
create policy project_members_delete_owner
on public.project_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_members.project_id
      and p.user_id = (select auth.uid())
  )
);

-- =============================================================================
-- 14. PROJECT COSTS POLICIES
-- =============================================================================

drop policy if exists project_costs_select on public.project_costs;
create policy project_costs_select
on public.project_costs
for select
to authenticated
using (
  public.can_view_project_costs(project_id, (select auth.uid()))
);

drop policy if exists project_costs_insert_owner on public.project_costs;
create policy project_costs_insert_owner
on public.project_costs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_costs.project_id
      and p.user_id = (select auth.uid())
  )
  and user_id = (select auth.uid())
);

drop policy if exists project_costs_update_owner on public.project_costs;
create policy project_costs_update_owner
on public.project_costs
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_costs.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_costs.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists project_costs_delete_owner on public.project_costs;
create policy project_costs_delete_owner
on public.project_costs
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_costs.project_id
      and p.user_id = (select auth.uid())
  )
);

-- =============================================================================
-- 15. AUTO-CREATE PERSONAL ORGANIZATION FUNCTION
--
-- Function is defined but intentionally NOT attached to auth.users here:
-- the original migration notes an existing on_user_profile_created trigger.
-- Attach this function from that existing profile trigger, or add a separate
-- auth.users trigger only after confirming no other signup flow creates orgs.
-- =============================================================================

create or replace function public.create_personal_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_slug text;
  v_name text;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  v_slug := lower(
    regexp_replace(v_name, '[^a-z0-9]+', '-', 'g')
  );
  v_slug := regexp_replace(v_slug, '^-+|-+$', '');

  if v_slug = '' then
    v_slug := 'user-' || substr(new.id::text, 1, 8);
  end if;

  -- Add a stable per-user suffix to avoid slug collisions.
  v_slug := v_slug || '-' || substr(replace(new.id::text, '-', ''), 1, 8);

  -- Make the function safe if called more than once for the same user.
  if exists (
    select 1
    from public.organizations o
    where o.owner_user_id = new.id
      and o.deleted_at is null
      and o.slug = v_slug
  ) then
    return new;
  end if;

  insert into public.organizations (name, slug, owner_user_id)
  values (v_name || '''s Organization', v_slug, new.id)
  returning id into v_org_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    joined_at
  )
  values (v_org_id, new.id, 'owner', now())
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;

commit;

-- =============================================================================
-- END
-- =============================================================================
