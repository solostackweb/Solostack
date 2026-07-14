-- =============================================================================
-- 0068_lead_client_review.sql
--
-- Clients auto-created from a public lead form arrive with only the details a
-- prospect would fill in (name, email, phone, country). The freelancer still
-- needs to verify the operational fields a client can't be trusted to provide
-- correctly — GST registration status, state code, billing address — before
-- that client is used on invoices / contracts.
--
-- `needs_review` flags exactly those records so the app can surface a "verify
-- these details" prompt and clear it once the freelancer confirms. Defaults to
-- false so every existing / manually-created client is unaffected.
-- =============================================================================

alter table public.clients
  add column if not exists needs_review boolean not null default false;
