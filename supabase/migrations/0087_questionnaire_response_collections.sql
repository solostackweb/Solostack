-- Reusable questionnaire collectors, append-only responses, and optional
-- Google Sheets mirroring.

create table if not exists public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  send_id uuid not null references public.questionnaire_sends (id) on delete cascade,
  questionnaire_id uuid references public.questionnaires (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  submission_key uuid not null,
  questions jsonb not null default '[]'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  sheets_sync_status text not null default 'not_configured'
    check (sheets_sync_status in ('not_configured', 'pending', 'synced', 'failed')),
  sheets_sync_error text,
  sheets_synced_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (send_id, submission_key)
);

alter table public.questionnaire_responses enable row level security;

drop policy if exists "questionnaire_responses_owner" on public.questionnaire_responses;
create policy "questionnaire_responses_owner" on public.questionnaire_responses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists questionnaire_responses_questionnaire_idx
  on public.questionnaire_responses (questionnaire_id, submitted_at desc);
create index if not exists questionnaire_responses_send_idx
  on public.questionnaire_responses (send_id, submitted_at desc);
create index if not exists questionnaire_responses_user_idx
  on public.questionnaire_responses (user_id, submitted_at desc);

create table if not exists public.questionnaire_sheet_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_url text not null,
  sheet_title text not null default 'Responses',
  columns jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionnaire_id)
);

alter table public.questionnaire_sheet_integrations enable row level security;

drop policy if exists "questionnaire_sheet_integrations_owner" on public.questionnaire_sheet_integrations;
create policy "questionnaire_sheet_integrations_owner"
  on public.questionnaire_sheet_integrations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists questionnaire_sheet_integrations_user_idx
  on public.questionnaire_sheet_integrations (user_id, updated_at desc);

insert into public.questionnaire_responses (
  user_id, send_id, questionnaire_id, client_id, project_id, submission_key,
  questions, responses, submitted_at, created_at
)
select
  user_id, id, questionnaire_id, client_id, project_id, id,
  questions, responses, coalesce(submitted_at, updated_at, created_at),
  coalesce(submitted_at, updated_at, created_at)
from public.questionnaire_sends
where status = 'completed'
  and jsonb_typeof(responses) = 'object'
  and responses <> '{}'::jsonb
on conflict (send_id, submission_key) do nothing;

-- A send now represents an open collector link. The legacy response JSON is
-- retained for rollback/audit compatibility but is no longer authoritative.
update public.questionnaire_sends
set status = 'sent', updated_at = now()
where status = 'completed';

