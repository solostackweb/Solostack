-- =============================================================================
-- 0095_portal_projects.sql
--
-- Junction table linking projects to portals.
-- Enables clients to review completed projects and see project progress.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. portal_projects table
-- ---------------------------------------------------------------------------
create table if not exists public.portal_projects (
  portal_id    uuid not null references public.portals(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  added_at     timestamptz not null default now(),
  added_by     uuid not null references auth.users(id) on delete cascade,
  review_invited_at timestamptz,
  primary key (portal_id, project_id)
);

create index if not exists portal_projects_project_idx
  on public.portal_projects (project_id);

create index if not exists portal_projects_review_invited_idx
  on public.portal_projects (portal_id, review_invited_at)
  where review_invited_at is not null;

-- ---------------------------------------------------------------------------
-- 2. RLS policies for portal_projects
-- ---------------------------------------------------------------------------
alter table public.portal_projects enable row level security;

-- Freelancer (portal owner) can manage all project links
drop policy if exists portal_projects_owner_all on public.portal_projects;
create policy portal_projects_owner_all
  on public.portal_projects
  for all
  using (
    exists (
      select 1 from public.portals p
      where p.id = portal_projects.portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Client (portal member) can read project links for their portal
drop policy if exists portal_projects_member_read on public.portal_projects;
create policy portal_projects_member_read
  on public.portal_projects
  for select
  using (
    exists (
      select 1 from public.portals p
      join public.portal_members m on m.portal_id = p.id
      where p.id = portal_projects.portal_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and p.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Trigger to auto-link completed projects to portal
-- ---------------------------------------------------------------------------
-- When a project is marked completed and has a client_id, and the freelancer
-- has a portal for that client, automatically link the project to the portal.
create or replace function public.auto_link_completed_project_to_portal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portal_id uuid;
begin
  -- Only run on status change to 'completed'
  if new.status <> 'completed' or (old.status = 'completed' and new.status = 'completed') then
    return new;
  end if;

  -- Need a client to link to a portal
  if new.client_id is null then
    return new;
  end if;

  -- Find active portal for this owner + client
  select p.id into v_portal_id
  from public.portals p
  where p.owner_user_id = new.user_id
    and p.client_id = new.client_id
    and p.status = 'active'
    and p.deleted_at is null
  limit 1;

  if v_portal_id is null then
    return new;
  end if;

  -- Link project to portal (upsert to handle race conditions)
  insert into public.portal_projects (portal_id, project_id, added_by)
  values (v_portal_id, new.id, new.user_id)
  on conflict (portal_id, project_id) do nothing;

  return new;
end
$$;

drop trigger if exists auto_link_project_to_portal_trg on public.projects;
create trigger auto_link_project_to_portal_trg
after update of status on public.projects
for each row execute function public.auto_link_completed_project_to_portal();

-- ---------------------------------------------------------------------------
-- 4. Function to manually link project to portal (for freelancer UI)
-- ---------------------------------------------------------------------------
create or replace function public.link_project_to_portal(
  p_portal_id uuid,
  p_project_id uuid,
  p_user_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  -- Verify portal ownership
  select owner_user_id into v_owner
  from public.portals
  where id = p_portal_id
    and owner_user_id = p_user_id
    and deleted_at is null;

  if v_owner is null then
    return false;
  end if;

  -- Verify project ownership
  if not exists (
    select 1 from public.projects
    where id = p_project_id
      and user_id = p_user_id
  ) then
    return false;
  end if;

  insert into public.portal_projects (portal_id, project_id, added_by)
  values (p_portal_id, p_project_id, p_user_id)
  on conflict (portal_id, project_id) do nothing;

  return true;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Function to unlink project from portal
-- ---------------------------------------------------------------------------
create or replace function public.unlink_project_from_portal(
  p_portal_id uuid,
  p_project_id uuid,
  p_user_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select owner_user_id into v_owner
  from public.portals
  where id = p_portal_id
    and owner_user_id = p_user_id
    and deleted_at is null;

  if v_owner is null then
    return false;
  end if;

  delete from public.portal_projects
  where portal_id = p_portal_id
    and project_id = p_project_id;

  return true;
end
$$;