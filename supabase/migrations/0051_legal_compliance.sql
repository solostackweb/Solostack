-- =============================================================================
-- 0051_legal_compliance.sql — DPDP Act consent records + account deletion
-- -----------------------------------------------------------------------------
-- Adds:
--   1. A fix to security_events.kind CHECK (adds 'rate_limit_tripped' used by
--      the rate limiter, plus account-deletion audit kinds).
--   2. user_consents — an append-only, versioned, timestamped record of the
--      explicit consent each user gives at signup. Required to *prove* consent
--      under India's DPDP Act, 2023.
--   3. Account-deletion lifecycle columns on user_profiles for the
--      grace-period-then-purge flow (request -> 30-day window -> hard purge).
-- =============================================================================

-- 1. ---- security_events.kind: extend the allowed set --------------------------
alter table public.security_events
  drop constraint if exists security_events_kind_check;

alter table public.security_events
  add constraint security_events_kind_check check (kind in (
    'auth_login_failed',
    'auth_signup_failed',
    'auth_signup_duplicate',
    'auth_ratelimit_tripped',
    'auth_password_reset_requested',
    'auth_password_changed',
    'rate_limit_tripped',
    'rls_guard_miss',
    'webhook_signature_invalid',
    'webhook_replay_detected',
    'storage_prefix_mismatch',
    'cron_monitor_alert',
    'suppression_hit',
    'consent_recorded',
    'account_deletion_requested',
    'account_deletion_cancelled',
    'account_purged',
    'other'
  ));

-- 2. ---- user_consents: provable, versioned consent ----------------------------
create table if not exists public.user_consents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- What the user consented to. 'signup' = the bundled Terms + Privacy +
  -- data-processing acceptance at account creation.
  kind            text not null default 'signup'
                    check (kind in ('signup', 'terms_reaccept', 'marketing')),
  -- Versions of the documents in force at the moment of consent, so we can
  -- prove exactly what the user agreed to even after the docs change.
  terms_version   text not null,
  privacy_version text not null,
  -- Hash of the exact consent statement shown, for tamper-evidence.
  consent_hash    text,
  -- Method: 'checkbox' (email signup) or 'oauth' (Google — acceptance shown
  -- before the OAuth redirect).
  method          text not null default 'checkbox',
  ip              text,
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index if not exists user_consents_user_id_idx
  on public.user_consents (user_id, created_at desc);

alter table public.user_consents enable row level security;

-- A user may read their own consent history (transparency / DPDP access right).
drop policy if exists user_consents_select_own on public.user_consents;
create policy user_consents_select_own
  on public.user_consents
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Writes are service-role only (recorded server-side at signup). No client
-- INSERT/UPDATE/DELETE policy => append-only from the app's trusted path.

-- 3. ---- Account deletion lifecycle on user_profiles ---------------------------
alter table public.user_profiles
  add column if not exists deletion_status text not null default 'active'
    check (deletion_status in ('active', 'pending_deletion')),
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_at timestamptz;

-- The purge cron scans for accounts whose grace window has elapsed.
create index if not exists user_profiles_deletion_scheduled_idx
  on public.user_profiles (deletion_scheduled_at)
  where deletion_status = 'pending_deletion';
