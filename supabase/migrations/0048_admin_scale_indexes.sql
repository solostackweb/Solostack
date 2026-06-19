-- =============================================================================
-- 0048_admin_scale_indexes.sql
--
-- Founder-console scale foundations (Admin hardening A0).
--
--   * Trigram (GIN) indexes for every admin ILIKE '%term%' search that
--     wasn't already covered, so search stops doing sequential scans.
--   * Btree indexes on the status/created_at columns admin lists filter +
--     order by but didn't have a matching composite.
--   * admin_files_total_bytes() RPC so the Files page sums storage in the
--     database instead of pulling up to 10k rows into the app.
--
-- All indexes use IF NOT EXISTS and plain CREATE INDEX (brief write lock,
-- fine at current volume). For very large tables you can instead run the
-- same statements with CREATE INDEX CONCURRENTLY outside a transaction.
-- =============================================================================

create extension if not exists pg_trgm;

-- ---- Users (admin_user_overview searches up.email / up.full_name) ----------
create index if not exists user_profiles_email_trgm_idx
  on public.user_profiles using gin (email gin_trgm_ops);
create index if not exists user_profiles_full_name_trgm_idx
  on public.user_profiles using gin (full_name gin_trgm_ops);

-- ---- Contracts (admin search by title) -------------------------------------
create index if not exists contracts_title_trgm_idx
  on public.contracts using gin (title gin_trgm_ops);

-- ---- Delivery logs (Emails page: search to_email/subject; filter status) ----
create index if not exists delivery_logs_to_email_trgm_idx
  on public.delivery_logs using gin (to_email gin_trgm_ops);
create index if not exists delivery_logs_subject_trgm_idx
  on public.delivery_logs using gin (subject gin_trgm_ops);
create index if not exists delivery_logs_status_created_idx
  on public.delivery_logs (status, created_at desc);
create index if not exists delivery_logs_created_idx
  on public.delivery_logs (created_at desc);

-- ---- Files (admin search by file_name; order by created_at) -----------------
create index if not exists files_file_name_trgm_idx
  on public.files using gin (file_name gin_trgm_ops);
create index if not exists files_created_idx
  on public.files (created_at desc);

-- ---- Email suppressions (admin search by email; correlated lower(email)) ----
create index if not exists email_suppressions_email_trgm_idx
  on public.email_suppressions using gin (email gin_trgm_ops);
create index if not exists email_suppressions_lower_email_idx
  on public.email_suppressions (lower(email));

-- ---- Billing payments (revenue/comms snapshots filter status + created_at) --
create index if not exists billing_payments_status_created_idx
  on public.billing_payments (status, created_at desc);

-- ---- Subscriptions (admin list orders by updated_at, filters status) --------
create index if not exists subscriptions_status_updated_idx
  on public.subscriptions (status, updated_at desc);

-- ---------------------------------------------------------------------------
-- RPC: total storage bytes (DB-side aggregate; replaces a 10k-row fetch).
-- SECURITY DEFINER so the service-role admin path can call it; it only
-- returns a single aggregate number (no row data leaks).
-- ---------------------------------------------------------------------------
create or replace function public.admin_files_total_bytes()
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(file_size), 0)::bigint from public.files;
$$;

revoke all on function public.admin_files_total_bytes() from public, anon, authenticated;
