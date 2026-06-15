-- =============================================================================
-- 0038_portal_phase1.sql
-- Phase 1 portal connectivity: calendar (.ics/webcal), realtime chat,
-- read receipts. Idempotent so it is safe to re-run.
-- =============================================================================

-- ---- Meetings: real scheduling source-of-truth for calendar events ----------
-- `proposed_time` stays as the human/freeform proposal. `scheduled_at` is the
-- machine timestamp set on confirm and used to generate .ics / webcal events.
alter table public.portal_meetings
  add column if not exists scheduled_at     timestamptz,
  add column if not exists duration_minutes integer not null default 30,
  add column if not exists timezone         text    not null default 'Asia/Kolkata';

-- ---- Members: read receipts + per-member calendar subscription token ---------
-- `last_read_at` powers "Seen" in chat. `calendar_feed_token` authorises the
-- webcal subscription feed (calendar apps fetch it without browser cookies, so
-- the URL must carry its own secret).
alter table public.portal_members
  add column if not exists last_read_at        timestamptz,
  add column if not exists calendar_feed_token text;

create unique index if not exists portal_members_calendar_feed_token_key
  on public.portal_members (calendar_feed_token)
  where calendar_feed_token is not null;

-- ---- Realtime: stream new chat messages to subscribed clients ----------------
-- RLS on portal_messages already scopes SELECT to portal members, and Realtime
-- honours RLS, so clients only ever receive their own portal's messages.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'portal_messages'
  ) then
    alter publication supabase_realtime add table public.portal_messages;
  end if;
end $$;
