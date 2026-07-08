-- =============================================================================
-- 0001_init_schema.sql — Core SoloStack schema
-- -----------------------------------------------------------------------------
-- Mirrors the tables defined in:
--   Original Stackivo implementation specification, § 2.1
--
-- Design notes:
--   * Every business table has a `user_id uuid` column referencing
--     `auth.users(id)` so RLS can use the standard
--     `USING (auth.uid() = user_id)` pattern (§ 2.2).
--   * `user_profiles` is a 1:1 extension of `auth.users` — all app-level
--     profile fields live here so we never touch the `auth` schema directly.
--   * String columns use explicit CHECK constraints for enum-like fields
--     rather than PG enums, so adding new values is a single migration.
-- =============================================================================

-- --- Extensions -------------------------------------------------------------
create extension if not exists "pgcrypto";

-- --- Helper: keep updated_at fresh -------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- --- user_profiles ----------------------------------------------------------
create table if not exists public.user_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null unique,
  avatar_url    text,
  company_name  text,
  gst_number    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- Automatically create a profile row when a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- --- clients ----------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text,
  phone         text,
  company_name  text,
  gst_number    text,
  address       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists clients_user_id_idx   on public.clients (user_id);
create index if not exists clients_email_idx     on public.clients (email);
create index if not exists clients_company_idx   on public.clients (company_name);

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- --- projects ---------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  name          text not null,
  description   text,
  status        text not null default 'planning'
                  check (status in ('lead','planning','active','on_hold','completed','archived')),
  start_date    date,
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists projects_user_id_idx    on public.projects (user_id);
create index if not exists projects_client_id_idx  on public.projects (client_id);
create index if not exists projects_status_idx     on public.projects (status);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- --- invoices ---------------------------------------------------------------
create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  client_id         uuid references public.clients(id) on delete set null,
  project_id        uuid references public.projects(id) on delete set null,
  invoice_number    text not null,
  issue_date        date not null,
  due_date          date not null,
  subtotal          numeric(14,2) not null default 0,
  gst_amount        numeric(14,2) not null default 0,
  total_amount      numeric(14,2) not null default 0,
  currency          text not null default 'INR',
  status            text not null default 'draft'
                      check (status in ('draft','sent','viewed','paid','overdue','partially_paid')),
  payment_link      text,
  payment_status    text,
  notes             text,
  terms             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, invoice_number)
);

create index if not exists invoices_user_id_idx    on public.invoices (user_id);
create index if not exists invoices_client_id_idx  on public.invoices (client_id);
create index if not exists invoices_project_id_idx on public.invoices (project_id);
create index if not exists invoices_status_idx     on public.invoices (status);
create index if not exists invoices_due_date_idx   on public.invoices (due_date);

create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

-- --- invoice_items ----------------------------------------------------------
create table if not exists public.invoice_items (
  id            uuid primary key default gen_random_uuid(),
  invoice_id    uuid not null references public.invoices(id) on delete cascade,
  description   text not null,
  quantity      numeric(12,3) not null default 1,
  unit_price    numeric(14,2) not null default 0,
  gst_rate      numeric(5,2)  not null default 0,
  amount        numeric(14,2) not null default 0,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- --- contracts --------------------------------------------------------------
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  title         text not null,
  content       text,
  status        text not null default 'draft'
                  check (status in ('draft','sent','viewed','signed','declined','expired')),
  public_token  text unique,
  signed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists contracts_user_id_idx      on public.contracts (user_id);
create index if not exists contracts_client_id_idx    on public.contracts (client_id);
create index if not exists contracts_status_idx       on public.contracts (status);
create index if not exists contracts_public_token_idx on public.contracts (public_token);

create trigger contracts_set_updated_at
before update on public.contracts
for each row execute function public.set_updated_at();

-- --- files ------------------------------------------------------------------
create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  file_size     bigint not null default 0,
  mime_type     text,
  created_at    timestamptz not null default now()
);

create index if not exists files_user_id_idx    on public.files (user_id);
create index if not exists files_project_id_idx on public.files (project_id);

-- --- notifications ----------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,
  title         text not null,
  message       text,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_read_idx    on public.notifications (read);
