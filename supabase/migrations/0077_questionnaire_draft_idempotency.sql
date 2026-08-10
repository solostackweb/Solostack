alter table public.questionnaires
  add column if not exists idempotency_key text;

create unique index if not exists questionnaires_user_idempotency_idx
  on public.questionnaires (user_id, idempotency_key)
  where idempotency_key is not null;
