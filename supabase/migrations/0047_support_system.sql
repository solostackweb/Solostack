-- =============================================================================
-- 0047_support_system.sql
--
-- First-party help & support system. Replaces the Crisp + Zoho Desk
-- integration (migration 0022 `support_threads`) with a fully owned
-- ticket + conversation model stored in our own database.
--
--   support_tickets          — one conversation/thread per support request.
--   support_messages         — the message bodies (customer / agent / system / ai).
--   support_canned_responses — reusable agent reply snippets (admin-managed).
--
-- Design notes:
--   * Tickets can be authenticated (user_id set) OR guest (user_id null,
--     identified by email + public_token from the marketing contact form).
--   * `public_token` authorises guest read/continue + email threading
--     (support+<token>@stackivo.me) without an account.
--   * Internal notes live in support_messages with is_internal_note = true
--     and are NEVER exposed to the customer (enforced by RLS + server reads).
--   * Realtime is enabled on support_messages so the in-app chat widget
--     updates live (reusing the portal-chat pattern from 0024/0038).
--   * Admin/founder console reads/writes via the service-role client, which
--     bypasses RLS. Customer-facing reads go through RLS below.
--
-- The legacy `support_threads` table is intentionally left untouched; it is
-- no longer written to or read once S6 lands.
-- =============================================================================

-- pgcrypto provides gen_random_bytes() for the guest/public token default
-- (already enabled in 0001; re-asserted here so this migration is self-contained).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. support_tickets
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references auth.users(id) on delete set null,
  email                    text not null,
  name                     text,
  subject                  text not null,
  status                   text not null default 'new' check (
    status in ('new', 'open', 'waiting_on_customer', 'waiting_on_us', 'resolved', 'closed')
  ),
  priority                 text not null default 'normal' check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  category                 text check (
    category is null or category in (
      'billing', 'bug', 'how-to', 'feature-request', 'account', 'onboarding'
    )
  ),
  -- Plan captured at creation time so SLA / queue priority is stable even if
  -- the user later upgrades or downgrades.
  plan_at_creation         text not null default 'free' check (
    plan_at_creation in ('free', 'pro', 'business')
  ),
  assignee_user_id         uuid references auth.users(id) on delete set null,
  tags                     text[] not null default '{}'::text[],
  channel                  text not null default 'in_app' check (
    channel in ('in_app', 'chat', 'email', 'contact_form')
  ),
  -- Guest access + inbound-email correlation token.
  public_token             text not null unique default encode(gen_random_bytes(18), 'hex'),
  source_page              text,
  trace_id                 text,
  -- SLA + lifecycle timestamps.
  sla_due_at               timestamptz,
  first_response_at        timestamptz,
  resolved_at              timestamptz,
  last_message_at          timestamptz not null default now(),
  last_customer_message_at timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_support_tickets_user_recent
  on public.support_tickets (user_id, last_message_at desc)
  where user_id is not null;

create index if not exists idx_support_tickets_status_recent
  on public.support_tickets (status, last_message_at desc);

create index if not exists idx_support_tickets_assignee
  on public.support_tickets (assignee_user_id, last_message_at desc)
  where assignee_user_id is not null;

create index if not exists idx_support_tickets_tags
  on public.support_tickets using gin (tags);

create index if not exists idx_support_tickets_token
  on public.support_tickets (public_token);

-- ---------------------------------------------------------------------------
-- 2. support_messages
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id                  uuid primary key default gen_random_uuid(),
  ticket_id           uuid not null references public.support_tickets(id) on delete cascade,
  author_type         text not null check (
    author_type in ('customer', 'agent', 'system', 'ai')
  ),
  author_user_id      uuid references auth.users(id) on delete set null,
  body                text not null,
  attachments         jsonb not null default '[]'::jsonb,
  via                 text not null default 'in_app' check (
    via in ('in_app', 'chat', 'email')
  ),
  -- Inbound-email dedupe key (RFC 5322 Message-ID). Unique when present.
  external_message_id text,
  is_internal_note    boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_support_messages_ticket
  on public.support_messages (ticket_id, created_at);

create unique index if not exists idx_support_messages_external_id
  on public.support_messages (external_message_id)
  where external_message_id is not null;

-- ---------------------------------------------------------------------------
-- 3. support_canned_responses (admin-managed)
-- ---------------------------------------------------------------------------
create table if not exists public.support_canned_responses (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  shortcut   text,
  body       text not null,
  category   text check (
    category is null or category in (
      'billing', 'bug', 'how-to', 'feature-request', 'account', 'onboarding'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.support_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.support_set_updated_at();

drop trigger if exists trg_support_canned_updated_at on public.support_canned_responses;
create trigger trg_support_canned_updated_at
  before update on public.support_canned_responses
  for each row execute function public.support_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
--    Customers may read/write ONLY their own tickets + non-internal messages.
--    Guests + admin go through the service-role client (bypasses RLS).
-- ---------------------------------------------------------------------------
alter table public.support_tickets          enable row level security;
alter table public.support_messages         enable row level security;
alter table public.support_canned_responses enable row level security;

-- support_tickets: owner can see + create + append to their own tickets.
drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own on public.support_tickets
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own on public.support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists support_tickets_update_own on public.support_tickets;
create policy support_tickets_update_own on public.support_tickets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- support_messages: visible only on the owner's tickets, and never internal
-- notes. Customers may insert their own (non-internal, non-agent) messages.
drop policy if exists support_messages_select_own on public.support_messages;
create policy support_messages_select_own on public.support_messages
  for select to authenticated
  using (
    is_internal_note = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists support_messages_insert_own on public.support_messages;
create policy support_messages_insert_own on public.support_messages
  for insert to authenticated
  with check (
    is_internal_note = false
    and author_type = 'customer'
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

-- support_canned_responses: no authenticated policies → admin (service-role)
-- only. Customers never touch this table.

-- ---------------------------------------------------------------------------
-- 6. Realtime — push new support_messages to the in-app chat widget.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'support_tickets'
  ) then
    alter publication supabase_realtime add table public.support_tickets;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Storage bucket for support attachments (user-scoped prefix convention).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

create policy support_attachments_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy support_attachments_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy support_attachments_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy support_attachments_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'support-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
