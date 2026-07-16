-- Questionnaires: reusable client-intake forms.
--
-- `questionnaires` are the freelancer's editable templates. Sending one to a
-- client snapshots its questions into `questionnaire_sends` (so later edits to
-- the template never change an already-sent form) with a public token the
-- client uses to fill it in. Responses land back on that send row and can be
-- surfaced on the client / project.

create table if not exists public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questionnaires enable row level security;

drop policy if exists "questionnaires_owner" on public.questionnaires;
create policy "questionnaires_owner" on public.questionnaires
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists questionnaires_user_idx
  on public.questionnaires (user_id, created_at desc);

create table if not exists public.questionnaire_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_id uuid references public.questionnaires (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  -- Snapshot of the questions at send time.
  questions jsonb not null default '[]'::jsonb,
  -- Map of questionId -> answer (string | string[] | number).
  responses jsonb not null default '{}'::jsonb,
  status text not null default 'sent', -- sent | completed
  public_token text not null unique,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questionnaire_sends enable row level security;

drop policy if exists "questionnaire_sends_owner" on public.questionnaire_sends;
create policy "questionnaire_sends_owner" on public.questionnaire_sends
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists q_sends_user_idx
  on public.questionnaire_sends (user_id, created_at desc);
create index if not exists q_sends_client_idx
  on public.questionnaire_sends (client_id);
create index if not exists q_sends_project_idx
  on public.questionnaire_sends (project_id);
