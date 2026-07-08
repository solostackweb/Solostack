-- =============================================================================
-- 0005_business_identity.sql — Onboarding, business identity, GST setup,
--                              client GST fields, lifetime client tracking.
-- -----------------------------------------------------------------------------
-- Source of truth:
--   Stackivo GST compliance matrix (v1.0 MVP logic)
--
-- Adds the columns that drive:
--   * Onboarding state machine (`onboarding_completed`, `onboarding_step`)
--   * Business identity (legal name, business name, type, address, locale)
--   * GST registration profile (gst_registered, gstin, pan, state_code)
--   * Invoice preferences (numbering + defaults — populated at onboarding,
--     consumed once invoice biz logic is added in a later phase)
--   * Free-plan enforcement (`lifetime_clients_created`)
--   * GST-aware client structure (gst_registered, gstin, state_code)
-- =============================================================================

-- --- user_profiles: business identity + onboarding --------------------------
alter table public.user_profiles
  add column if not exists legal_name           text,
  add column if not exists business_name        text,
  add column if not exists business_type        text
    check (business_type is null or business_type in (
      'individual','sole_proprietor','partnership','llp','private_limited','other'
    )),
  add column if not exists gst_registered       boolean not null default false,
  add column if not exists gstin                text,
  add column if not exists pan                  text,
  add column if not exists address_line1        text,
  add column if not exists address_line2        text,
  add column if not exists city                 text,
  add column if not exists state_code           text,
  add column if not exists postal_code          text,
  add column if not exists country              text not null default 'IN',
  add column if not exists default_currency     text not null default 'INR',
  add column if not exists timezone             text not null default 'Asia/Kolkata',
  add column if not exists invoice_prefix       text default 'INV-',
  add column if not exists invoice_next_number  int  not null default 1,
  add column if not exists invoice_default_due_days int not null default 14,
  add column if not exists invoice_default_notes text,
  add column if not exists invoice_default_terms text,
  add column if not exists onboarding_completed     boolean not null default false,
  add column if not exists onboarding_completed_at  timestamptz,
  add column if not exists onboarding_step          text not null default 'business'
    check (onboarding_step in ('business','gst','invoice','first_client','done')),
  add column if not exists lifetime_clients_created bigint not null default 0;

-- Optional MVP-level format checks. They use IS NULL OR <regex> so existing
-- rows survive backfill.
do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_gstin_format
    check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_pan_format
    check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_state_code_format
    check (state_code is null or state_code ~ '^[0-9]{2}$');
exception when duplicate_object then null; end $$;

-- If gst_registered is true, gstin and state_code MUST be populated.
do $$ begin
  alter table public.user_profiles
    add constraint user_profiles_gst_consistency
    check (
      gst_registered = false
      or (gstin is not null and state_code is not null)
    );
exception when duplicate_object then null; end $$;

create index if not exists user_profiles_onboarding_completed_idx
  on public.user_profiles (onboarding_completed);

-- --- clients: GST-aware fields ---------------------------------------------
alter table public.clients
  add column if not exists business_name    text,
  add column if not exists gst_registered   boolean not null default false,
  add column if not exists state_code       text,
  add column if not exists billing_address  text;

-- The existing `gst_number` column from 0001 is retained as the canonical
-- GSTIN store. We add a check constraint mirroring the seller GSTIN format.
do $$ begin
  alter table public.clients
    add constraint clients_gstin_format
    check (gst_number is null or gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.clients
    add constraint clients_state_code_format
    check (state_code is null or state_code ~ '^[0-9]{2}$');
exception when duplicate_object then null; end $$;

-- If client is GST registered, GSTIN + state are required.
do $$ begin
  alter table public.clients
    add constraint clients_gst_consistency
    check (
      gst_registered = false
      or (gst_number is not null and state_code is not null)
    );
exception when duplicate_object then null; end $$;

create index if not exists clients_state_code_idx     on public.clients (state_code);
create index if not exists clients_gst_registered_idx on public.clients (gst_registered);

-- --- Lifetime client counter -----------------------------------------------
-- Increments on every new client insert. NEVER decrements on delete — the
-- free-plan limit (5 lifetime clients) must withstand churn / cleanup.
create or replace function public.increment_lifetime_clients()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.user_profiles
    set lifetime_clients_created = lifetime_clients_created + 1
  where id = new.user_id;
  return new;
end $$;

drop trigger if exists clients_increment_lifetime on public.clients;
create trigger clients_increment_lifetime
after insert on public.clients
for each row execute function public.increment_lifetime_clients();
