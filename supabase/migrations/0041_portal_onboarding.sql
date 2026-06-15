-- =============================================================================
-- 0041_portal_onboarding.sql
-- Phase 3: branded welcome (video + message) on portals. Idempotent.
-- =============================================================================

alter table public.portals
  add column if not exists welcome_video_url text,
  add column if not exists welcome_message   text;
