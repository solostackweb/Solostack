-- Attach proposals to client portals.

create table if not exists public.portal_proposals (
  portal_id uuid not null references public.portals(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid not null references auth.users(id) on delete cascade,
  primary key (portal_id, proposal_id)
);

create index if not exists portal_proposals_proposal_idx
  on public.portal_proposals (proposal_id);

alter table public.portal_proposals enable row level security;

drop policy if exists portal_proposals_owner_select on public.portal_proposals;
drop policy if exists portal_proposals_member_select on public.portal_proposals;
drop policy if exists portal_proposals_owner_write on public.portal_proposals;

create policy portal_proposals_owner_select on public.portal_proposals
  for select using (
    exists (
      select 1 from public.portals p
      where p.id = portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

create policy portal_proposals_member_select on public.portal_proposals
  for select using (
    exists (
      select 1
      from public.portal_members m
      join public.portals p on p.id = m.portal_id
      where m.portal_id = portal_proposals.portal_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
        and p.status = 'active'
        and p.deleted_at is null
    )
  );

create policy portal_proposals_owner_write on public.portal_proposals
  for all using (
    exists (
      select 1 from public.portals p
      where p.id = portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  ) with check (
    exists (
      select 1 from public.portals p
      where p.id = portal_id
        and p.owner_user_id = auth.uid()
        and p.deleted_at is null
    )
  );

alter table public.portal_document_comments
  drop constraint if exists portal_document_comments_doc_type_check;

alter table public.portal_document_comments
  add constraint portal_document_comments_doc_type_check
  check (doc_type in ('contract', 'invoice', 'welcome', 'proposal'));
