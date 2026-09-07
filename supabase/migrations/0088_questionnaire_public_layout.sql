-- Questionnaire owners can choose a focused guided flow or a conventional
-- single-page public form. Existing questionnaires keep the guided default.

alter table public.questionnaires
  add column if not exists public_layout text not null default 'guided';

alter table public.questionnaires
  drop constraint if exists questionnaires_public_layout_check;
alter table public.questionnaires
  add constraint questionnaires_public_layout_check
  check (public_layout in ('guided', 'classic'));

alter table public.questionnaire_sends
  add column if not exists public_layout text not null default 'guided';

alter table public.questionnaire_sends
  drop constraint if exists questionnaire_sends_public_layout_check;
alter table public.questionnaire_sends
  add constraint questionnaire_sends_public_layout_check
  check (public_layout in ('guided', 'classic'));

