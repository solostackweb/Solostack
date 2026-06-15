-- =============================================================================
-- 0039_portal_phase2.sql
-- Phase 2: document comments/annotations + "what's new since last visit".
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---- "What's new since your last visit" -------------------------------------
-- Distinct from last_read_at (chat). Marks the last time a member opened the
-- portal home, so we can surface what changed since then.
alter table public.portal_members
  add column if not exists last_seen_at timestamptz;

-- ---- Document comments / annotations ----------------------------------------
create table if not exists public.portal_document_comments (
  id          uuid primary key default gen_random_uuid(),
  portal_id   uuid not null references public.portals(id) on delete cascade,
  doc_type    text not null check (doc_type in ('contract', 'invoice', 'welcome')),
  doc_id      uuid not null,
  author_id   uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists portal_document_comments_doc_idx
  on public.portal_document_comments (portal_id, doc_type, doc_id, created_at);

alter table public.portal_document_comments enable row level security;

-- Membership predicate (inline; mirrors portal_messages policies, no recursion).
drop policy if exists portal_document_comments_select on public.portal_document_comments;
create policy portal_document_comments_select on public.portal_document_comments for select
  using (
    exists (
      select 1 from public.portals p
       where p.id = portal_document_comments.portal_id
         and (
           p.owner_user_id = auth.uid()
           or exists (
             select 1 from public.portal_members m
              where m.portal_id = p.id
                and m.user_id = auth.uid()
                and m.revoked_at is null
           )
         )
    )
  );

drop policy if exists portal_document_comments_insert on public.portal_document_comments;
create policy portal_document_comments_insert on public.portal_document_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.portals p
       where p.id = portal_document_comments.portal_id
         and (
           p.owner_user_id = auth.uid()
           or exists (
             select 1 from public.portal_members m
              where m.portal_id = p.id
                and m.user_id = auth.uid()
                and m.revoked_at is null
           )
         )
    )
  );

drop policy if exists portal_document_comments_update on public.portal_document_comments;
create policy portal_document_comments_update on public.portal_document_comments for update
  using (
    author_id = auth.uid()
    or public.portal_is_owner(portal_document_comments.portal_id, auth.uid())
  );

drop policy if exists portal_document_comments_delete on public.portal_document_comments;
create policy portal_document_comments_delete on public.portal_document_comments for delete
  using (
    author_id = auth.uid()
    or public.portal_is_owner(portal_document_comments.portal_id, auth.uid())
  );

-- Realtime for live comment threads.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'portal_document_comments'
  ) then
    alter publication supabase_realtime add table public.portal_document_comments;
  end if;
end $$;
