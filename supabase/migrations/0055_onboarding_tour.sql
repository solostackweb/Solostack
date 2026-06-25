-- =============================================================================
-- 0055_onboarding_tour.sql
-- -----------------------------------------------------------------------------
-- Persist whether a user has completed (or dismissed) the first-run product
-- tour, so it shows once per ACCOUNT rather than once per browser. Defaults to
-- false; the tour marks it true on finish/skip. A "Replay tour" control simply
-- re-launches the tour via a URL flag and does not need to reset this column.
-- =============================================================================

alter table public.user_profiles
  add column if not exists onboarding_tour_done boolean not null default false;
