-- One logical questionnaire delivery must create at most one public response
-- link, even when a client double-clicks or a server action is retried.
alter table public.questionnaire_sends
  add column if not exists idempotency_key text;

create unique index if not exists questionnaire_sends_user_idempotency_idx
  on public.questionnaire_sends (user_id, idempotency_key)
  where idempotency_key is not null;
