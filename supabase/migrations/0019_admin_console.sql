-- =============================================================================
-- 0019_admin_console.sql
--
-- Founder Console schema. Adds:
--
--   1. `admin_actions`         append-only audit of every admin write
--   2. `admin_notes`           sticky-note style internal notes per entity
--   3. `platform_settings`     KV store for platform-wide toggles
--   4. `admin_user_overview`   denormalized read view for the users list
--   5. `admin_readonly` role   for the SQL escape hatch in /admin/query
--
-- Auth model is OUT of band: admin status lives on
--   `auth.users.raw_app_meta_data -> 'role' = 'admin'`
-- and is set manually via SQL.
--
-- All three tables are RLS-enabled and have NO authenticated policy --
-- they are read/written exclusively by the service-role client through
-- `@/src/features/admin/server.ts`.
-- =============================================================================

-- --- admin_actions ---------------------------------------------------------
--
-- Every admin write goes through `runAdminAction()` in
-- `@/src/features/admin/server.ts`, which appends a row here. Reads of
-- sensitive surfaces (full user record, raw email body, etc.) also write
-- a row with kind = '<resource>.read' so DPDP data-access requests are
-- trivially answerable. Forensic-grade: no UPDATE / DELETE policy.

create table if not exists public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id) on delete restrict,
  kind         text not null,
  target_type  text not null
                 check (target_type in (
                   'user',
                   'subscription',
                   'invoice',
                   'contract',
                   'file',
                   'email',
                   'notification',
                   'security_event',
                   'settings',
                   'query',
                   'system'
                 )),
  target_id    text,
  success      boolean not null,
  duration_ms  integer not null check (duration_ms >= 0),
  metadata     jsonb not null default '{}'::jsonb,
  request_id   text,
  created_at   timestamptz not null default now()
);

create index if not exists admin_actions_created_idx
  on public.admin_actions (created_at desc);
create index if not exists admin_actions_actor_idx
  on public.admin_actions (actor_id, created_at desc);
create index if not exists admin_actions_target_idx
  on public.admin_actions (target_type, target_id, created_at desc);
create index if not exists admin_actions_kind_idx
  on public.admin_actions (kind, created_at desc);

alter table public.admin_actions enable row level security;
-- No policy. Service role only.

-- --- admin_notes -----------------------------------------------------------
--
-- Internal notes attachable to any entity (user, subscription, invoice,
-- etc.). Markdown rendered. Pinnable. No threading -- light by design.

create table if not exists public.admin_notes (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id) on delete restrict,
  target_type  text not null
                 check (target_type in (
                   'user',
                   'subscription',
                   'invoice',
                   'contract',
                   'file',
                   'email'
                 )),
  target_id    text not null,
  body         text not null check (length(body) between 1 and 4000),
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists admin_notes_target_idx
  on public.admin_notes (target_type, target_id, pinned desc, created_at desc);

drop trigger if exists admin_notes_set_updated_at on public.admin_notes;
create trigger admin_notes_set_updated_at
  before update on public.admin_notes
  for each row execute function public.set_updated_at();

alter table public.admin_notes enable row level security;
-- No policy. Service role only.

-- --- platform_settings -----------------------------------------------------
--
-- Single KV table for platform-wide toggles. Keys are application-defined
-- strings (e.g. 'maintenance_mode', 'email_live_mode_override',
-- 'public_signups_enabled'). Values are JSONB to support any shape.

create table if not exists public.platform_settings (
  key          text primary key,
  value        jsonb not null,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table public.platform_settings enable row level security;
-- No policy. Service role only. Public reads happen via a denylist of
-- safe keys exposed through a server action when needed (none in phase 1).

-- --- admin_user_overview ---------------------------------------------------
--
-- Denormalized read view powering the /admin/users list. Joins
-- user_profiles + auth.users + latest subscription + aggregate counts.
-- At < 100k users it runs in < 50ms; convert to MATERIALIZED VIEW with
-- a 5-min refresh cron when p50 crosses 100ms.

create or replace view public.admin_user_overview as
select
  up.id,
  up.full_name,
  up.email,
  up.avatar_url,
  up.company_name,
  up.country,
  au.created_at         as signed_up_at,
  au.last_sign_in_at,
  au.email_confirmed_at,
  au.banned_until,
  sub.plan,
  sub.status            as subscription_status,
  sub.current_period_end,
  (select count(*) from public.invoices i
     where i.user_id = up.id)                  as invoice_count,
  (select count(*) from public.clients c
     where c.user_id = up.id)                  as client_count,
  (select coalesce(sum(amount), 0) from public.billing_payments bp
     where bp.user_id = up.id and bp.status = 'captured')
                                                 as total_revenue_paise,
  (select count(*) from public.email_suppressions es
     where lower(es.email) = lower(up.email))   as suppression_count
from public.user_profiles up
left join auth.users au on au.id = up.id
left join lateral (
  select plan, status, current_period_end
  from public.subscriptions s
  where s.user_id = up.id
  order by s.created_at desc
  limit 1
) sub on true;

comment on view public.admin_user_overview is
  'Denormalized founder-console view of every user. Service-role reads only.';

-- --- admin_readonly role ---------------------------------------------------
--
-- Backing role for the /admin/query SQL editor. NOLOGIN so it can never
-- be used directly; the route handler `set role admin_readonly;` for the
-- duration of a single statement with a hard timeout. Granted SELECT
-- everywhere in public schema; explicitly NOT granted access to auth,
-- storage, or any extensions schema.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'admin_readonly') then
    create role admin_readonly nologin;
  end if;
end $$;

grant usage on schema public to admin_readonly;
grant select on all tables in schema public to admin_readonly;
alter default privileges in schema public
  grant select on tables to admin_readonly;

-- =============================================================================
-- End 0019_admin_console.sql
-- =============================================================================
