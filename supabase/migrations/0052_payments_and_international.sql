-- =============================================================================
-- 0052_payments_and_international.sql
-- -----------------------------------------------------------------------------
-- Two foundations:
--   1. payment_connections — freelancer's OWN external payment platforms
--      (Wise / Payoneer / PayPal / Stripe link / bank / …). Stackivo never
--      collects; we only display these on the invoice. `provider` is free text
--      (validated app-side via a registry) so adding platforms needs no
--      migration. One row may be the default.
--   2. International clients + multi-currency: clients get country / currency /
--      locale / is_foreign; invoices get a locked FX rate + INR-equivalent +
--      an export (zero-rated) flag; profile gets an LUT number for the export
--      declaration. (FX/export columns are wired in later phases; added now to
--      avoid a second migration.)
-- =============================================================================

-- 1. ---- payment_connections -------------------------------------------------
create table if not exists public.payment_connections (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- App-side registry key: 'wise' | 'payoneer' | 'paypal' | 'stripe_link' |
  -- 'bank' | 'other' | … (kept as text so new platforms need no migration).
  provider     text not null,
  -- Display label shown to the client (defaults to the provider's name).
  label        text,
  -- 'link'   = `value` is a full pay URL (PayPal.me, Wise/Payoneer request link)
  -- 'handle' = `value` is an identifier (email/UPI-like) shown with instructions
  kind         text not null default 'link' check (kind in ('link', 'handle')),
  value        text not null,
  -- Optional note shown to the client (e.g. "Use Friends & Family").
  instructions text,
  is_default   boolean not null default false,
  status       text not null default 'active' check (status in ('active', 'disabled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists payment_connections_user_idx
  on public.payment_connections (user_id);

-- At most one default connection per user.
create unique index if not exists payment_connections_one_default_idx
  on public.payment_connections (user_id)
  where is_default;

alter table public.payment_connections enable row level security;

drop policy if exists payment_connections_owner_all on public.payment_connections;
create policy payment_connections_owner_all
  on public.payment_connections
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Public invoice display reads these via the service-role share layer, so no
-- anon policy is granted (consistent with the rest of the public-token model).

-- 2a. ---- clients: international fields --------------------------------------
alter table public.clients
  add column if not exists country  text not null default 'IN',
  add column if not exists currency text not null default 'INR',
  add column if not exists locale   text not null default 'en-IN',
  add column if not exists is_foreign boolean not null default false;

-- 2b. ---- invoices: FX + export (zero-rated) --------------------------------
alter table public.invoices
  -- FX rate locked at issue time so INR-equivalent reporting is stable.
  -- 1 for INR invoices.
  add column if not exists fx_rate_to_inr numeric(18, 6) not null default 1,
  -- Total converted to INR at issue (for Pulse / books). Defaults to total for
  -- INR; set explicitly for foreign-currency invoices.
  add column if not exists inr_equivalent numeric(14, 2),
  -- Export of services → zero-rated under LUT (no GST lines).
  add column if not exists is_export boolean not null default false;

create index if not exists invoices_currency_idx
  on public.invoices (user_id, currency);

-- 2c. ---- profile: LUT number for the export declaration --------------------
alter table public.user_profiles
  add column if not exists lut_number text;
