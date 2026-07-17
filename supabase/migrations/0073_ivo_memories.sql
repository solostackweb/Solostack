-- =============================================================================
-- 0073_ivo_memories.sql
--
-- Long-term memory for Ivo. Small, user-owned facts and preferences the
-- assistant is explicitly asked (or clearly expected) to remember — e.g.
-- "my standard rate is ₹2,500/hr", "always use Net-15 for Acme", "sign
-- emails as Arpit". Injected into the agent's system prompt each turn so
-- Ivo stays consistent across conversations. Never written by the model
-- directly — only through the guarded server runtime, capped per user.
-- =============================================================================

create table if not exists public.ivo_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ivo_memories_user_recent_idx
  on public.ivo_memories (user_id, created_at desc);

drop trigger if exists ivo_memories_set_updated_at on public.ivo_memories;
create trigger ivo_memories_set_updated_at
before update on public.ivo_memories
for each row execute function public.set_updated_at();

alter table public.ivo_memories enable row level security;

drop policy if exists ivo_memories_owner_select on public.ivo_memories;
drop policy if exists ivo_memories_owner_insert on public.ivo_memories;
drop policy if exists ivo_memories_owner_update on public.ivo_memories;
drop policy if exists ivo_memories_owner_delete on public.ivo_memories;

create policy ivo_memories_owner_select on public.ivo_memories
  for select using (auth.uid() = user_id);
create policy ivo_memories_owner_insert on public.ivo_memories
  for insert with check (auth.uid() = user_id);
create policy ivo_memories_owner_update on public.ivo_memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ivo_memories_owner_delete on public.ivo_memories
  for delete using (auth.uid() = user_id);
