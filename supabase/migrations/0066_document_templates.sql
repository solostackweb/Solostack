-- Reusable user-owned templates for proposals, invoice notes, and client emails.

create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_type text not null
    check (template_type in ('proposal', 'contract', 'invoice_note', 'email')),
  title text not null,
  description text,
  category text not null default 'general',
  content jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_templates_user_type_idx
  on public.document_templates (user_id, template_type, active, updated_at desc);

drop trigger if exists document_templates_set_updated_at on public.document_templates;
create trigger document_templates_set_updated_at
before update on public.document_templates
for each row execute function public.set_updated_at();

alter table public.document_templates enable row level security;

drop policy if exists document_templates_owner_select on public.document_templates;
drop policy if exists document_templates_owner_write on public.document_templates;

create policy document_templates_owner_select on public.document_templates
  for select using (auth.uid() = user_id);

create policy document_templates_owner_write on public.document_templates
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
