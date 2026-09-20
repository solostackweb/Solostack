-- =============================================================================
-- 0096_fix_public_profile_rpc.sql
--
-- P0 fix: get_public_profile RETURNS TABLE was missing columns that the
-- SELECT returns (legal_name, email, business_email, business_phone,
-- website), causing a positional type drift runtime error. Align the
-- contract with PublicProfileData in public-profile-server.ts.
--
-- Contact PII (business_email/website/business_phone) is shown publicly by
-- design — the profile is only readable when public_profile_enabled = true.
-- The page now prefers business_email and no longer renders the personal
-- email + business email as two rows.
-- =============================================================================

create or replace function public.get_public_profile(
  p_slug text
) returns table (
  id uuid,
  public_slug text,
  full_name text,
  display_name text,
  business_name text,
  legal_name text,
  role text,
  bio text,
  avatar_url text,
  email text,
  business_email text,
  business_phone text,
  website text,
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
-- P0 fix: portal_reviews_client_insert RLS assumed
-- projects.client_id = auth.uid(), but the app stores clients-table ids in
-- projects.client_id. Align RLS with the can_client_review_project() gate:
-- the project must be linked to this portal via portal_projects and completed.
-- ---------------------------------------------------------------------------
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
    and exists (
      select 1 from public.projects pr
      join public.portal_projects pp on pp.project_id = pr.id
      where pr.id = portal_reviews.project_id
        and pp.portal_id = portal_reviews.portal_id
        and pr.status = 'completed'
    )
  );

-- ---------------------------------------------------------------------------
-- P0 fix: canonicalise duplicate public-review RPCs.
-- get_public_profile_reviews (0094) is the canonical reader used by
-- public-profile-server.ts. Keep get_reviews_for_public_profile (0093) as a
-- thin wrapper so existing callers don't diverge.
-- ---------------------------------------------------------------------------
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
    r.id,
    r.portal_id,
    r.project_id,
    r.rating,
    r.title,
    r.body,
    r.created_at,
    r.project_name,
    r.client_name
  from public.get_public_profile_reviews(p_user_id, p_limit) as r(
    id uuid,
    portal_id uuid,
    project_id uuid,
    rating smallint,
    title text,
    body text,
    created_at timestamptz,
    project_name text,
    client_name text
  );
end
$$;
