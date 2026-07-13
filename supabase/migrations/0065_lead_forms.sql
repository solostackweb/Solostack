-- Public lead forms for clientflow intake.

create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  title text not null,
  description text,
  brand_color text not null default '#2563EB',
  active boolean not null default true,
  fields jsonb not null default '[
    {"name":"name","label":"Your name","type":"text","required":true},
    {"name":"email","label":"Email","type":"email","required":true},
    {"name":"company","label":"Company","type":"text","required":false},
    {"name":"phone","label":"Phone","type":"tel","required":false},
    {"name":"country","label":"Country","type":"text","required":false},
    {"name":"currency","label":"Preferred currency","type":"text","required":false},
    {"name":"project","label":"What do you need help with?","type":"textarea","required":true},
    {"name":"budget","label":"Estimated budget","type":"text","required":false},
    {"name":"timeline","label":"Timeline","type":"text","required":false}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_forms_user_idx
  on public.lead_forms (user_id, created_at desc);
create index if not exists lead_forms_active_slug_idx
  on public.lead_forms (slug)
  where active = true;

drop trigger if exists lead_forms_set_updated_at on public.lead_forms;
create trigger lead_forms_set_updated_at
before update on public.lead_forms
for each row execute function public.set_updated_at();

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.lead_forms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  email text not null,
  company text,
  phone text,
  project_summary text not null,
  budget text,
  timeline text,
  answers jsonb not null default '{}'::jsonb,
  ivo_prompt text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'converted', 'archived')),
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists lead_submissions_user_idx
  on public.lead_submissions (user_id, created_at desc);
create index if not exists lead_submissions_form_idx
  on public.lead_submissions (form_id, created_at desc);
create index if not exists lead_submissions_status_idx
  on public.lead_submissions (user_id, status, created_at desc);

alter table public.lead_forms enable row level security;
alter table public.lead_submissions enable row level security;

drop policy if exists lead_forms_owner_select on public.lead_forms;
drop policy if exists lead_forms_owner_write on public.lead_forms;
drop policy if exists lead_submissions_owner_select on public.lead_submissions;
drop policy if exists lead_submissions_owner_update on public.lead_submissions;

create policy lead_forms_owner_select on public.lead_forms
  for select using (auth.uid() = user_id);

create policy lead_forms_owner_write on public.lead_forms
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy lead_submissions_owner_select on public.lead_submissions
  for select using (auth.uid() = user_id);

create policy lead_submissions_owner_update on public.lead_submissions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
