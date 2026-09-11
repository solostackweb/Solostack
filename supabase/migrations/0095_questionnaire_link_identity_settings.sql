-- Give reusable questionnaire links an owner-facing name and let each
-- questionnaire decide whether respondent identity is collected.

alter table public.questionnaires
  add column if not exists collect_respondent_identity boolean not null default true;

alter table public.questionnaire_sends
  add column if not exists link_name text not null default 'Public collection link';

alter table public.questionnaire_sends
  add column if not exists collect_respondent_identity boolean not null default true;

alter table public.questionnaire_sends
  drop constraint if exists questionnaire_sends_link_name_length;

alter table public.questionnaire_sends
  add constraint questionnaire_sends_link_name_length
  check (char_length(btrim(link_name)) between 1 and 120);

