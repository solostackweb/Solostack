-- =============================================================================
-- 0092_portal_comment_mentions.sql
--
-- Adds @mentions support to portal document comments.
-- - Adds mentions column to portal_document_comments
-- - Creates portal_comment_mentions junction table for efficient querying
-- - Updates realtime publication
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add mentions column to portal_document_comments
-- ---------------------------------------------------------------------------
alter table public.portal_document_comments
  add column if not exists mentions uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 2. Create portal_comment_mentions junction table
--    For efficient "who mentioned me" queries and notifications
-- ---------------------------------------------------------------------------
create table if not exists public.portal_comment_mentions (
  comment_id  uuid not null references public.portal_document_comments(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists portal_comment_mentions_user_idx
  on public.portal_comment_mentions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. RLS for portal_comment_mentions
-- ---------------------------------------------------------------------------
alter table public.portal_comment_mentions enable row level security;

-- Portal members can read mentions in their portals
drop policy if exists portal_comment_mentions_select on public.portal_comment_mentions;
create policy portal_comment_mentions_select
  on public.portal_comment_mentions
  for select
  using (
    exists (
      select 1 from public.portal_document_comments dc
      join public.portals p on p.id = dc.portal_id
      left join public.portal_members m on m.portal_id = p.id and m.user_id = auth.uid() and m.revoked_at is null
      where dc.id = portal_comment_mentions.comment_id
        and (p.owner_user_id = auth.uid() or m.user_id is not null)
    )
  );

-- Only system/trigger can insert mentions (via the comment insert trigger)
drop policy if exists portal_comment_mentions_insert on public.portal_comment_mentions;
create policy portal_comment_mentions_insert
  on public.portal_comment_mentions
  for insert
  with check (
    false  -- only via trigger
  );

-- ---------------------------------------------------------------------------
-- 4. Function: extract mentions from comment body
--    Supports @full_name and @email formats
-- ---------------------------------------------------------------------------
create or replace function public.extract_portal_mentions(
  p_body text,
  p_portal_id uuid,
  p_author_id uuid
) returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_mentions uuid[];
  v_portal_members uuid[];
  v_member_map jsonb;
  v_mention text;
  v_user_id uuid;
begin
  -- Get all portal members (excluding the author)
  select array_agg(m.user_id) into v_portal_members
  from public.portal_members m
  where m.portal_id = p_portal_id
    and m.revoked_at is null
    and m.user_id != p_author_id;

  -- Build a map of member user_id -> full_name, email
  select jsonb_object_agg(m.user_id, jsonb_build_object(
    'full_name', m.profile->>'full_name',
    'email', m.profile->>'email'
  )) into v_member_map
  from (
    select m.user_id,
           jsonb_build_object('full_name', up.full_name, 'email', up.email) as profile
    from public.portal_members m
    join public.user_profiles up on up.id = m.user_id
    where m.portal_id = p_portal_id
      and m.revoked_at is null
      and m.user_id != p_author_id
  ) m;

  -- Extract @mentions from body using regex
  -- Matches @word or @word.word or @email@domain
  for v_mention in select regexp_match[1] from regexp_matches(p_body, '@([a-zA-Z0-9._-]+)', 'g') as regexp_match
  loop
    -- Try to match by full_name (split into parts)
    for v_user_id in select user_id from jsonb_each_text(v_member_map) as m(user_id, profile_json)
    loop
      declare
        v_profile jsonb := m.profile_json;
        v_full_name text := v_profile->>'full_name';
        v_email text := v_profile->>'email';
      begin
        -- Match by full name (first name or full name)
        if v_full_name is not null then
          if lower(v_mention) = lower(split_part(v_full_name, ' ', 1)) or
             lower(v_mention) = lower(v_full_name) then
            v_mentions := array_append(v_mentions, v_user_id);
          end if;
        end if;

        -- Match by email (local part or full email)
        if v_email is not null then
          if lower(v_mention) = lower(split_part(v_email, '@', 1)) or
             lower(v_mention) = lower(v_email) then
            v_mentions := array_append(v_mentions, v_user_id);
          end if;
        end if;
      end;
    end loop;
  end loop;

  return array_distinct(v_mentions);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Trigger: auto-populate mentions on comment insert
-- ---------------------------------------------------------------------------
create or replace function public.portal_comment_mentions_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mentions uuid[];
begin
  if tg_op = 'INSERT' then
    v_mentions := public.extract_portal_mentions(new.body, new.portal_id, new.author_id);
    if array_length(v_mentions, 1) > 0 then
      new.mentions := v_mentions;
      insert into public.portal_comment_mentions (comment_id, user_id)
      select new.id, unnest(v_mentions)
      on conflict do nothing;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists portal_comment_mentions_sync_trg on public.portal_document_comments;
create trigger portal_comment_mentions_sync_trg
before insert on public.portal_document_comments
for each row execute function public.portal_comment_mentions_sync();

-- ---------------------------------------------------------------------------
-- 6. Queue notifications for mentions
-- ---------------------------------------------------------------------------
create or replace function public.queue_portal_comment_mention_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mention uuid;
  v_portal_name text;
  v_doc_title text;
begin
  if tg_op = 'INSERT' and array_length(new.mentions, 1) > 0 then
    -- Get portal name for notification
    select p.name into v_portal_name
    from public.portals p
    where p.id = new.portal_id;

    -- Get document title based on type
    case new.doc_type
      when 'contract' then
        select c.title into v_doc_title from public.contracts c where c.id = new.doc_id;
      when 'invoice' then
        select c.invoice_number into v_doc_title from public.invoices c where c.id = new.doc_id;
      when 'welcome' then
        select w.title into v_doc_title from public.welcome_documents w where w.id = new.doc_id;
      when 'proposal' then
        select p.title into v_doc_title from public.proposals p where p.id = new.doc_id;
      else
        v_doc_title := 'Document';
    end case;

    -- Queue notification for each mentioned user
    foreach v_mention in array new.mentions
    loop
      insert into public.portal_notification_outbox (
        recipient_id, portal_id, event_type, payload, scheduled_for
      ) values (
        v_mention,
        new.portal_id,
        'comment.mentioned',
        jsonb_build_object(
          'commentId', new.id,
          'portalName', v_portal_name,
          'docType', new.doc_type,
          'docTitle', v_doc_title,
          'authorId', new.author_id,
          'preview', left(new.body, 120)
        ),
        now()
      ) on conflict do nothing;
    end loop;
  end if;
  return new;
end
$$;

drop trigger if exists portal_comment_mention_notifications_trg on public.portal_document_comments;
create trigger portal_comment_mention_notifications_trg
after insert on public.portal_document_comments
for each row execute function public.queue_portal_comment_mention_notifications();

-- ---------------------------------------------------------------------------
-- 7. Add realtime publication for portal_comment_mentions
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.portal_comment_mentions;

-- ---------------------------------------------------------------------------
-- 8. Function: get mentions for a user (for "my mentions" view)
-- ---------------------------------------------------------------------------
create or replace function public.get_user_portal_mentions(
  p_user_id uuid,
  p_limit int default 50
) returns table (
  comment_id uuid,
  portal_id uuid,
  portal_name text,
  doc_type text,
  doc_id uuid,
  doc_title text,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  resolved_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  return query
  select
    dc.id as comment_id,
    dc.portal_id,
    p.name as portal_name,
    dc.doc_type,
    dc.doc_id,
    case dc.doc_type
      when 'contract' then c.title
      when 'invoice' then i.invoice_number
      when 'welcome' then w.title
      when 'proposal' then pr.title
      else 'Document'
    end as doc_title,
    dc.author_id,
    up.full_name as author_name,
    dc.body,
    dc.created_at,
    dc.resolved_at
  from public.portal_comment_mentions cm
  join public.portal_document_comments dc on dc.id = cm.comment_id
  join public.portals p on p.id = dc.portal_id
  join public.user_profiles up on up.id = dc.author_id
  left join public.contracts c on c.id = dc.doc_id and dc.doc_type = 'contract'
  left join public.invoices i on i.id = dc.doc_id and dc.doc_type = 'invoice'
  left join public.welcome_documents w on w.id = dc.doc_id and dc.doc_type = 'welcome'
  left join public.proposals pr on pr.id = dc.doc_id and dc.doc_type = 'proposal'
  where cm.user_id = p_user_id
  order by dc.created_at desc
  limit p_limit;
end
$$;