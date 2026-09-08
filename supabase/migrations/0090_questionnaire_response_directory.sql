-- Searchable response identity for the paginated questionnaire directory.
alter table public.questionnaire_responses
  add column if not exists respondent_name text
  generated always as (responses ->> '__respondent_name') stored;

alter table public.questionnaire_responses
  add column if not exists respondent_email text
  generated always as (responses ->> '__respondent_email') stored;

create index if not exists questionnaire_responses_name_search_idx
  on public.questionnaire_responses (user_id, questionnaire_id, lower(respondent_name) text_pattern_ops);

create index if not exists questionnaire_responses_email_search_idx
  on public.questionnaire_responses (user_id, questionnaire_id, lower(respondent_email) text_pattern_ops);
