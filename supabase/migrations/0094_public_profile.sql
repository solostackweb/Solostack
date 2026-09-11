-- =============================================================================
-- 0094_public_profile.sql
--
-- Public Freelancer/Studio Profile for Stackivo
--
-- Allows freelancers to have a public profile page at stackivo.me/@username
-- displaying verified reviews, portfolio, and a "Start a Project" CTA.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add public profile columns to user_profiles
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists public_slug text unique,
  add column if not exists public_profile_enabled boolean default false,
  add column if not exists public_bio text,
  add column if not exists public_services text[],
  add column if not exists public_industries text[],
  add column if not exists public_location text,
  add column if not exists public_languages text[],
  add column if not exists public_availability text,
  add column if not exists public_starting_rate numeric(12, 2),
  add column if not exists public_starting_rate_currency text default 'INR',
  add column if not exists public_show_reviews boolean default true,
  add column if not exists public_show_portfolio boolean default true,
  add column if not exists public_show_stats boolean default true,
  add column if not exists public_cta_text text default 'Start a project',
  add column if not exists public_cta_action text default 'enquiry',
  add column if not exists public_custom_domain text,
  add column if not exists public_seo_title text,
  add column if not exists public_seo_description text,
  add column if not exists public_og_image text;

-- Index for public slug lookups
create index if not exists user_profiles_public_slug_idx
  on public.user_profiles (public_slug)
  where public_slug is not null and public_profile_enabled = true;

-- ---------------------------------------------------------------------------
-- 2. Public Portfolio Items Table
-- ---------------------------------------------------------------------------
create table if not exists public.public_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  title text not null,
  description text,
  cover_image_url text,
  images text[] default '{}',
  category text,
  industry text,
  budget_range text,
  duration text,
  technologies text[],
  client_name text,
  client_industry text,
  testimonial text,
  featured boolean default false,
  sort_order int default 0,
  published boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_portfolio_items_user_idx
  on public.public_portfolio_items (user_id, sort_order, created_at desc)
  where published = true;

alter table public.public_portfolio_items enable row level security;

-- Owner can manage their portfolio
create policy public_portfolio_owner_all on public.public_portfolio_items
  for all using (
    user_id = auth.uid()
  );

-- Public can read published portfolio items
create policy public_portfolio_public_read on public.public_portfolio_items
  for select using (
    published = true
    and exists (
      select 1 from public.user_profiles up
      where up.id = public_portfolio_items.user_id
        and up.public_profile_enabled = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Trigger for updated_at on portfolio items
-- ---------------------------------------------------------------------------
create or replace function public.public_portfolio_items_touch_updated_at()
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

drop trigger if exists public_portfolio_items_updated_at_trg on public.public_portfolio_items;
create trigger public_portfolio_items_updated_at_trg
before update on public.public_portfolio_items
for each row execute function public.public_portfolio_items_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Function: get_public_profile
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile(
  p_slug text
) returns table (
  id uuid,
  public_slug text,
  full_name text,
  display_name text,
  business_name text,
  role text,
  bio text,
  avatar_url text,
  brand_color text,
  brand_tagline text,
  brand_intro text,
  public_bio text,
  public_services text[],
  public_industries text[],
  public_location text,
  public_languages text[],
  public_availability text,
  public_starting_rate numeric,
  public_starting_rate_currency text,
  public_show_reviews boolean,
  public_show_portfolio boolean,
  public_show_stats boolean,
  public_cta_text text,
  public_cta_action text,
  public_custom_domain text,
  public_seo_title text,
  public_seo_description text,
  public_og_image text,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    up.id,
    up.public_slug,
    up.full_name,
    up.display_name,
    up.business_name,
    up.legal_name,
    up.role,
    up.bio,
    up.avatar_url,
    up.email,
    up.business_email,
    up.business_phone,
    up.website,
    up.brand_color,
    up.brand_tagline,
    up.brand_intro,
    up.public_bio,
    up.public_services,
    up.public_industries,
    up.public_location,
    up.public_languages,
    up.public_availability,
    up.public_starting_rate,
    up.public_starting_rate_currency,
    up.public_show_reviews,
    up.public_show_portfolio,
    up.public_show_stats,
    up.public_cta_text,
    up.public_cta_action,
    up.public_custom_domain,
    up.public_seo_title,
    up.public_seo_description,
    up.public_og_image,
    up.created_at
  from public.user_profiles up
  where up.public_slug = p_slug
    and up.public_profile_enabled = true;
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Function: get_public_profile_stats
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile_stats(
  p_user_id uuid
) returns table (
  completed_projects int,
  verified_reviews int,
  average_rating numeric,
  repeat_clients int,
  total_project_value numeric,
  on_time_delivery_rate numeric
) language plpgsql security definer set search_path = public as $$
declare
  v_completed_projects int;
  v_reviews_count int;
  v_avg_rating numeric;
  v_repeat_clients int;
  v_total_value numeric;
  v_on_time_rate numeric;
begin
  -- Completed projects count
  select count(*) into v_completed_projects
  from public.projects
  where user_id = p_user_id
    and status = 'completed';

  -- Verified reviews and average rating
  select count(*), avg(rating)::numeric(3,2)
  into v_reviews_count, v_avg_rating
  from public.portal_reviews pr
  join public.portals po on po.id = pr.portal_id
  where po.owner_user_id = p_user_id;

  -- Repeat clients (clients with >1 completed project)
  select count(*) into v_repeat_clients
  from (
    select client_id, count(*) as project_count
    from public.projects
    where user_id = p_user_id
      and status = 'completed'
    group by client_id
    having count(*) > 1
  ) rc;

  -- Total project value (sum of invoices for completed projects)
  select coalesce(sum(i.total_amount), 0) into v_total_value
  from public.invoices i
  join public.projects p on p.id = i.project_id
  where p.user_id = p_user_id
    and p.status = 'completed'
    and i.status = 'paid';

  -- On-time delivery rate (projects completed by due_date)
  select case
    when count(*) = 0 then 100
    else round(100.0 * sum(case when p.due_date is null or p.completed_at <= p.due_date then 1 else 0 end) / count(*), 1)
  end into v_on_time_rate
  from public.projects p
  where p.user_id = p_user_id
    and p.status = 'completed'
    and p.due_date is not null
    and p.completed_at is not null;

  return query select v_completed_projects, v_reviews_count, v_avg_rating, v_repeat_clients, v_total_value, v_on_time_rate;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Function: get_public_portfolio
-- ---------------------------------------------------------------------------
create or replace function public.get_public_portfolio(
  p_user_id uuid,
  p_limit int default 12
) returns table (
  id uuid,
  project_id uuid,
  title text,
  description text,
  cover_image_url text,
  images text[],
  category text,
  industry text,
  budget_range text,
  duration text,
  technologies text[],
  client_name text,
  client_industry text,
  testimonial text,
  featured boolean,
  sort_order int,
  created_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    ppi.id,
    ppi.project_id,
    ppi.title,
    ppi.description,
    ppi.cover_image_url,
    ppi.images,
    ppi.category,
    ppi.industry,
    ppi.budget_range,
    ppi.duration,
    ppi.technologies,
    ppi.client_name,
    ppi.client_industry,
    ppi.testimonial,
    ppi.featured,
    ppi.sort_order,
    ppi.created_at
  from public.public_portfolio_items ppi
  where ppi.user_id = p_user_id
    and ppi.published = true
  order by ppi.featured desc, ppi.sort_order, ppi.created_at desc
  limit p_limit;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Function: get_public_profile_reviews (with limit for public display)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile_reviews(
  p_user_id uuid,
  p_limit int default 10
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
-- 8. RLS for user_profiles public access
-- ---------------------------------------------------------------------------
-- Allow public read of enabled profiles
drop policy if exists user_profiles_public_read on public.user_profiles;
create policy user_profiles_public_read
  on public.user_profiles
  for select
  using (
    public_profile_enabled = true
    and public_slug is not null
  );

-- ---------------------------------------------------------------------------
-- 9. Function: check_slug_available
-- ---------------------------------------------------------------------------
create or replace function public.check_slug_available(
  p_slug text,
  p_exclude_user_id uuid default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  -- Validate slug format
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$|^[a-z0-9]$' then
    return false;
  end if;

  -- Reserved slugs
  if p_slug in ('api', 'www', 'app', 'dashboard', 'admin', 'login', 'signup', 'settings', 'profile', 'portal', 'p', 'c', 'i', 'q', 'w', 'm', 'feed', 'sitemap', 'robots', 'search', 'help', 'support', 'pricing', 'features', 'about', 'contact', 'blog', 'docs', 'legal', 'privacy', 'terms', 'security', 'status', 'changelog', 'roadmap', 'careers', 'press', 'brand', 'assets', 'static', 'media', 'files', 'uploads', 'downloads', 'assets', 'images', 'icons', 'fonts', 'css', 'js', 'scripts', 'styles', 'dist', 'build', 'public', 'private', 'internal', 'test', 'dev', 'staging', 'prod', 'production', 'localhost') then
    return false;
  end if;

  select count(*) into v_count
  from public.user_profiles
  where public_slug = p_slug
    and (p_exclude_user_id is null or id != p_exclude_user_id);

  return v_count = 0;
end
$$;

-- ---------------------------------------------------------------------------
-- 10. Function: claim_public_slug
-- ---------------------------------------------------------------------------
create or replace function public.claim_public_slug(
  p_user_id uuid,
  p_slug text
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_available boolean;
begin
  select public.check_slug_available(p_slug, p_user_id) into v_available;
  if not v_available then
    return false;
  end if;

  update public.user_profiles
  set public_slug = p_slug,
      public_profile_enabled = true
  where id = p_user_id;

  return true;
end
$$;