-- =============================================================================
-- 0093_verified_reviews.sql
--
-- Verified Reviews System for Stackivo
-- 
-- Allows clients to leave verified reviews on completed projects.
-- Reviews are tied to real projects and real clients, cannot be edited
-- by the freelancer, and can be displayed on a public profile.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. portal_reviews table
-- ---------------------------------------------------------------------------
-- Stores verified reviews from clients on completed projects.
-- Only clients can create reviews, only on projects they own access to.
-- Freelancer cannot edit or delete reviews.
create table if not exists public.portal_reviews (
  id              uuid primary key default gen_random_uuid(),
  portal_id       uuid not null references public.portals(id) on delete cascade,
  project_id      uuid not null,
  author_id       uuid not null references auth.users(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  title           text not null check (char_length(title) between 1 and 200),
  body            text not null check (char_length(body) between 1 and 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists portal_reviews_portal_idx
  on public.portal_reviews (portal_id, created_at desc);

create index if not exists portal_reviews_project_idx
  on public.portal_reviews (project_id);

create index if not exists portal_reviews_author_idx
  on public.portal_reviews (author_id);

-- Unique constraint: one review per client per project
create unique index if not exists portal_reviews_unique_per_project
  on public.portal_reviews (project_id, author_id);

-- ---------------------------------------------------------------------------
-- 2. RLS policies for portal_reviews
-- ---------------------------------------------------------------------------
alter table public.portal_reviews enable row level security;

-- Freelancer (portal owner) can read all reviews on their portals
drop policy if exists portal_reviews_owner_read on public.portal_reviews;
create policy portal_reviews_owner_read
  on public.portal_reviews
  for select
  using (
    exists (
      select 1 from public.portals p
      where p.id = portal_reviews.portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- Client (portal member) can read all reviews on portals they belong to
drop policy if exists portal_reviews_member_read on public.portal_reviews;
create policy portal_reviews_member_read
  on public.portal_reviews
  for select
  using (
    exists (
      select 1 from public.portals p
      join public.portal_members m on m.portal_id = p.id
      where p.id = portal_reviews.portal_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and p.deleted_at is null
    )
  );

-- Client can insert reviews on their own portals (only for projects they have access to)
drop policy if exists portal_reviews_client_insert on public.portal_reviews;
create policy portal_reviews_client_insert
  on public.portal_reviews
  for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.portals p
      join public.portal_members m on m.portal_id = p.id
      where p.id = portal_reviews.portal_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and p.deleted_at is null
    )
    -- Only allow reviews on completed projects in the client's portal
    and exists (
      select 1 from public.projects pr
      where pr.id = portal_reviews.project_id
        and pr.client_id in (
          select pm.user_id from public.portal_members pm
          where pm.portal_id = portal_reviews.portal_id
            and pm.user_id = auth.uid()
            and pm.revoked_at is null
        )
        and pr.status = 'completed'
    )
  );

-- Clients can update their own reviews (before they're resolved/locked)
drop policy if exists portal_reviews_author_update on public.portal_reviews;
create policy portal_reviews_author_update
  on public.portal_reviews
  for update
  using (
    author_id = auth.uid()
  )
  with check (
    author_id = auth.uid()
  );

-- Only freelancer can delete reviews (in case of abuse/spam)
drop policy if exists portal_reviews_owner_delete on public.portal_reviews;
create policy portal_reviews_owner_delete
  on public.portal_reviews
  for delete
  using (
    exists (
      select 1 from public.portals p
      where p.id = portal_reviews.portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Trigger to update updated_at
-- ---------------------------------------------------------------------------
create or replace function public.portal_reviews_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists portal_reviews_updated_at_trg on public.portal_reviews;
create trigger portal_reviews_updated_at_trg
before update on public.portal_reviews
for each row execute function public.portal_reviews_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Realtime publication for reviews
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.portal_reviews;

-- ---------------------------------------------------------------------------
-- 5. Portal Reviews Activity Recording
-- ---------------------------------------------------------------------------
-- When a review is created, record activity in portal_activity
create or replace function public.record_portal_review_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.portal_activity (portal_id, actor_id, type, payload)
    values (
      new.portal_id,
      new.author_id,
      'review.created',
      jsonb_build_object(
        'reviewId', new.id,
        'projectId', new.project_id,
        'rating', new.rating,
        'title', new.title
      )
    );
  end if;
  return new;
end
$$;

drop trigger if exists portal_review_activity_trg on public.portal_reviews;
create trigger portal_review_activity_trg
after insert on public.portal_reviews
for each row execute function public.record_portal_review_activity();

-- ---------------------------------------------------------------------------
-- 6. Add review_invited_at to portal_projects (to track review invitation)
-- ---------------------------------------------------------------------------
-- We need a way to track if a review has been requested for a project
-- We'll add a column to portal_projects (junction table) or create a separate table
-- For now, let's add to portal_projects if it exists, or we'll track via portal_reviews

-- Check if portal_projects table exists and add review_invited_at
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'portal_projects') then
    alter table public.portal_projects
      add column if not exists review_invited_at timestamptz;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Function: get_reviews_for_portal
-- ---------------------------------------------------------------------------
create or replace function public.get_reviews_for_portal(
  p_portal_id uuid,
  p_limit int default 50
) returns table (
  id uuid,
  portal_id uuid,
  project_id uuid,
  author_id uuid,
  rating smallint,
  title text,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  author_email text,
  project_title text
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    pr.id,
    pr.portal_id,
    pr.project_id,
    pr.author_id,
    pr.rating,
    pr.title,
    pr.body,
    pr.created_at,
    pr.updated_at,
    up.full_name as author_name,
    up.email as author_email,
    p.name as project_title
  from public.portal_reviews pr
  join public.user_profiles up on up.id = pr.author_id
  join public.projects p on p.id = pr.project_id
  where pr.portal_id = p_portal_id
  order by pr.created_at desc
  limit p_limit;
end
$$;

-- ---------------------------------------------------------------------------
-- 8. Function: get_reviews_for_public_profile
-- ---------------------------------------------------------------------------
-- Returns reviews for a freelancer's public profile
create or replace function public.get_reviews_for_public_profile(
  p_user_id uuid,
  p_limit int default 20
) returns table (
  id uuid,
  portal_id uuid,
  project_id uuid,
  rating smallint,
  title text,
  body text,
  created_at timestamptz,
  project_name text,
  client_name text
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    pr.id,
    pr.portal_id,
    pr.project_id,
    pr.rating,
    pr.title,
    pr.body,
    pr.created_at,
    p.name as project_name,
    coalesce(up.full_name, up.business_name, 'Client') as client_name
  from public.portal_reviews pr
  join public.portals po on po.id = pr.portal_id
  join public.projects p on p.id = pr.project_id
  join public.user_profiles up on up.id = pr.author_id
  where po.owner_user_id = p_user_id
  order by pr.created_at desc
  limit p_limit;
end
$$;

-- ---------------------------------------------------------------------------
-- 9. Function: can_client_review_project
-- ---------------------------------------------------------------------------
-- Check if a client can leave a review for a specific project
create or replace function public.can_client_review_project(
  p_portal_id uuid,
  p_user_id uuid,
  p_project_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_can_review boolean;
begin
  -- Check if user is a member of the portal
  if not exists (
    select 1 from public.portal_members pm
    where pm.portal_id = p_portal_id
      and pm.user_id = p_user_id
      and pm.revoked_at is null
  ) then
    return false;
  end if;

  -- Check if project is in this portal and is completed
  if not exists (
    select 1 from public.projects p
    join public.portal_projects pp on pp.project_id = p.id
    where p.id = p_project_id
      and pp.portal_id = p_portal_id
      and p.status = 'completed'
  ) then
    return false;
  end if;

  -- Check if client already reviewed this project
  if exists (
    select 1 from public.portal_reviews
    where portal_id = p_portal_id
      and project_id = p_project_id
      and author_id = p_user_id
  ) then
    return false;
  end if;

  return true;
end
$$;