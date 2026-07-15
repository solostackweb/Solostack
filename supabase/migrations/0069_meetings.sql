-- Meetings: lightweight in-product scheduling.
--
-- A meeting belongs to a freelancer (user_id) and can optionally attach to a
-- client, project, proposal, or contract. The freelancer proposes a few time
-- slots; the client picks one from a public link (no login) which sets
-- scheduled_at and flips status to "confirmed". Video ("meet_link") is filled
-- in later (Phase 2 embeds Daily.co). This reuses the same comms/ICS patterns
-- already used by portal meetings, but is not portal-scoped.

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  proposal_id uuid references public.proposals (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  topic text not null,
  notes text,
  duration_minutes integer not null default 30,
  timezone text not null default 'Asia/Kolkata',
  -- Array of ISO-8601 start times the freelancer offered.
  proposed_slots jsonb not null default '[]'::jsonb,
  -- The slot the client confirmed (source of truth for calendar events).
  scheduled_at timestamptz,
  meet_link text,
  location text,
  -- proposed | confirmed | cancelled | completed
  status text not null default 'proposed',
  -- Secret used by the public confirm link (client is not logged in).
  public_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings enable row level security;

-- Owners manage their own meetings. Public confirm goes through the service
-- role (server action) scoped by public_token, so no anon policy is needed.
drop policy if exists "meetings_owner_all" on public.meetings;
create policy "meetings_owner_all" on public.meetings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists meetings_user_idx on public.meetings (user_id, created_at desc);
create index if not exists meetings_proposal_idx on public.meetings (proposal_id);
create index if not exists meetings_contract_idx on public.meetings (contract_id);
create index if not exists meetings_client_idx on public.meetings (client_id);
create index if not exists meetings_project_idx on public.meetings (project_id);
