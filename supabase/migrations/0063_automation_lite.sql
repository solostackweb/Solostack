-- Approval-first automation recipes and suggestions.

create table if not exists public.automation_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_key text not null,
  name text not null,
  description text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trigger_key)
);

create index if not exists automation_recipes_user_idx
  on public.automation_recipes (user_id, enabled);

drop trigger if exists automation_recipes_set_updated_at on public.automation_recipes;
create trigger automation_recipes_set_updated_at
before update on public.automation_recipes
for each row execute function public.set_updated_at();

alter table public.automation_recipes enable row level security;

drop policy if exists automation_recipes_owner_select on public.automation_recipes;
drop policy if exists automation_recipes_owner_insert on public.automation_recipes;
drop policy if exists automation_recipes_owner_update on public.automation_recipes;
drop policy if exists automation_recipes_owner_delete on public.automation_recipes;

create policy automation_recipes_owner_select on public.automation_recipes
  for select using (auth.uid() = user_id);

create policy automation_recipes_owner_insert on public.automation_recipes
  for insert with check (auth.uid() = user_id);

create policy automation_recipes_owner_update on public.automation_recipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy automation_recipes_owner_delete on public.automation_recipes
  for delete using (auth.uid() = user_id);

create table if not exists public.automation_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.automation_recipes(id) on delete set null,
  trigger_key text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  description text,
  prompt text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'dismissed', 'expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acted_at timestamptz,
  expires_at timestamptz
);

create index if not exists automation_suggestions_user_status_idx
  on public.automation_suggestions (user_id, status, created_at desc);
create index if not exists automation_suggestions_entity_idx
  on public.automation_suggestions (entity_type, entity_id);

alter table public.automation_suggestions enable row level security;

drop policy if exists automation_suggestions_owner_select on public.automation_suggestions;
drop policy if exists automation_suggestions_owner_insert on public.automation_suggestions;
drop policy if exists automation_suggestions_owner_update on public.automation_suggestions;
drop policy if exists automation_suggestions_owner_delete on public.automation_suggestions;

create policy automation_suggestions_owner_select on public.automation_suggestions
  for select using (auth.uid() = user_id);

create policy automation_suggestions_owner_insert on public.automation_suggestions
  for insert with check (auth.uid() = user_id);

create policy automation_suggestions_owner_update on public.automation_suggestions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy automation_suggestions_owner_delete on public.automation_suggestions
  for delete using (auth.uid() = user_id);
