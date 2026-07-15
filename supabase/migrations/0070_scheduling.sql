-- Live scheduling: Google Calendar connection + minimal availability rules.
-- Optional upgrade — everything is gated behind env config; without it the
-- meetings feature falls back to the manual propose-slots flow.

create table if not exists public.calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null default 'google',
  google_email text,
  -- Tokens are stored encrypted (AES-256-GCM) via TOKEN_ENCRYPTION_KEY.
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;

drop policy if exists "calendar_connections_owner" on public.calendar_connections;
create policy "calendar_connections_owner" on public.calendar_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.scheduling_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Asia/Kolkata',
  -- Weekday (0=Sun .. 6=Sat) -> array of [start,end] "HH:MM" ranges.
  working_hours jsonb not null default
    '{"1":[["09:00","17:00"]],"2":[["09:00","17:00"]],"3":[["09:00","17:00"]],"4":[["09:00","17:00"]],"5":[["09:00","17:00"]]}'::jsonb,
  buffer_minutes integer not null default 15,
  min_notice_hours integer not null default 12,
  slot_interval_minutes integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scheduling_settings enable row level security;

drop policy if exists "scheduling_settings_owner" on public.scheduling_settings;
create policy "scheduling_settings_owner" on public.scheduling_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
