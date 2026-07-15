-- =============================================================================
-- 0072_ivo_conversation_runtime.sql
--
-- Durable, user-owned conversation and execution history for Ivo. This is the
-- persistence foundation for the server-owned runtime; no model or automation
-- receives direct table access.
-- =============================================================================

create table if not exists public.ivo_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  current_mode text not null default 'general'
    check (current_mode in (
      'general', 'invoice', 'contract', 'welcome_document', 'client',
      'project', 'time_entry', 'support'
    )),
  workflow_state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The current UI resumes one active thread. Historical threads are retained
-- as archived conversations for later history UX and account export/erasure.
create unique index if not exists ivo_conversations_one_active_per_user_idx
  on public.ivo_conversations (user_id)
  where status = 'active';

create index if not exists ivo_conversations_user_recent_idx
  on public.ivo_conversations (user_id, last_message_at desc);

drop trigger if exists ivo_conversations_set_updated_at on public.ivo_conversations;
create trigger ivo_conversations_set_updated_at
before update on public.ivo_conversations
for each row execute function public.set_updated_at();

alter table public.ivo_conversations enable row level security;

drop policy if exists ivo_conversations_owner_select on public.ivo_conversations;
drop policy if exists ivo_conversations_owner_insert on public.ivo_conversations;
drop policy if exists ivo_conversations_owner_update on public.ivo_conversations;
drop policy if exists ivo_conversations_owner_delete on public.ivo_conversations;

create policy ivo_conversations_owner_select on public.ivo_conversations
  for select using (auth.uid() = user_id);
create policy ivo_conversations_owner_insert on public.ivo_conversations
  for insert with check (auth.uid() = user_id);
create policy ivo_conversations_owner_update on public.ivo_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_conversations_owner_delete on public.ivo_conversations
  for delete using (auth.uid() = user_id);

create table if not exists public.ivo_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ivo_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  kind text not null default 'text'
    check (kind in ('text', 'question', 'picker', 'preview', 'confirmation', 'result', 'error')),
  content text,
  payload jsonb not null default '{}'::jsonb,
  client_message_id text,
  created_at timestamptz not null default now(),
  unique (conversation_id, client_message_id)
);

create index if not exists ivo_messages_conversation_created_idx
  on public.ivo_messages (conversation_id, created_at asc);
create index if not exists ivo_messages_user_created_idx
  on public.ivo_messages (user_id, created_at desc);

alter table public.ivo_messages enable row level security;

drop policy if exists ivo_messages_owner_select on public.ivo_messages;
drop policy if exists ivo_messages_owner_insert on public.ivo_messages;
drop policy if exists ivo_messages_owner_update on public.ivo_messages;
drop policy if exists ivo_messages_owner_delete on public.ivo_messages;

create policy ivo_messages_owner_select on public.ivo_messages
  for select using (auth.uid() = user_id);
create policy ivo_messages_owner_insert on public.ivo_messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.ivo_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );
create policy ivo_messages_owner_update on public.ivo_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_messages_owner_delete on public.ivo_messages
  for delete using (auth.uid() = user_id);

create table if not exists public.ivo_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ivo_conversations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  request_key text,
  provider text,
  model text,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  outcome text,
  error_code text,
  prompt_tokens integer,
  completion_tokens integer,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ivo_runs_user_created_idx
  on public.ivo_runs (user_id, created_at desc);
create index if not exists ivo_runs_conversation_created_idx
  on public.ivo_runs (conversation_id, created_at desc);
create unique index if not exists ivo_runs_user_request_key_idx
  on public.ivo_runs (user_id, request_key)
  where request_key is not null;

alter table public.ivo_runs enable row level security;

drop policy if exists ivo_runs_owner_select on public.ivo_runs;
drop policy if exists ivo_runs_owner_insert on public.ivo_runs;
drop policy if exists ivo_runs_owner_update on public.ivo_runs;
drop policy if exists ivo_runs_owner_delete on public.ivo_runs;

create policy ivo_runs_owner_select on public.ivo_runs
  for select using (auth.uid() = user_id);
create policy ivo_runs_owner_insert on public.ivo_runs
  for insert with check (auth.uid() = user_id);
create policy ivo_runs_owner_update on public.ivo_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_runs_owner_delete on public.ivo_runs
  for delete using (auth.uid() = user_id);

create table if not exists public.ivo_action_attempts (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.ivo_conversations(id) on delete set null,
  run_id uuid references public.ivo_runs(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_key text not null,
  idempotency_key text not null,
  approval_state text not null default 'not_required'
    check (approval_state in ('not_required', 'required', 'approved', 'rejected')),
  status text not null default 'proposed'
    check (status in ('proposed', 'executing', 'succeeded', 'failed', 'cancelled')),
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id uuid,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists ivo_action_attempts_user_created_idx
  on public.ivo_action_attempts (user_id, created_at desc);
create index if not exists ivo_action_attempts_conversation_created_idx
  on public.ivo_action_attempts (conversation_id, created_at desc);

drop trigger if exists ivo_action_attempts_set_updated_at on public.ivo_action_attempts;
create trigger ivo_action_attempts_set_updated_at
before update on public.ivo_action_attempts
for each row execute function public.set_updated_at();

alter table public.ivo_action_attempts enable row level security;

drop policy if exists ivo_action_attempts_owner_select on public.ivo_action_attempts;
drop policy if exists ivo_action_attempts_owner_insert on public.ivo_action_attempts;
drop policy if exists ivo_action_attempts_owner_update on public.ivo_action_attempts;
drop policy if exists ivo_action_attempts_owner_delete on public.ivo_action_attempts;

create policy ivo_action_attempts_owner_select on public.ivo_action_attempts
  for select using (auth.uid() = user_id);
create policy ivo_action_attempts_owner_insert on public.ivo_action_attempts
  for insert with check (auth.uid() = user_id);
create policy ivo_action_attempts_owner_update on public.ivo_action_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_action_attempts_owner_delete on public.ivo_action_attempts
  for delete using (auth.uid() = user_id);
