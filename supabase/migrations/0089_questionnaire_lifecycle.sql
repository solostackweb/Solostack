-- Questionnaire lifecycle controls: reusable owner templates, safely revoked
-- collection links, and stable Google Sheet metadata.

alter table public.questionnaire_sends
  add column if not exists revoked_at timestamptz;

create index if not exists questionnaire_sends_active_questionnaire_idx
  on public.questionnaire_sends (questionnaire_id, created_at desc)
  where revoked_at is null;

alter table public.questionnaire_sheet_integrations
  add column if not exists sheet_id integer not null default 0;
alter table public.questionnaire_sheet_integrations
  add column if not exists format_version integer not null default 0;

create table if not exists public.questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questionnaire_templates enable row level security;

drop policy if exists "questionnaire_templates_owner" on public.questionnaire_templates;
create policy "questionnaire_templates_owner" on public.questionnaire_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists questionnaire_templates_user_idx
  on public.questionnaire_templates (user_id, updated_at desc);
