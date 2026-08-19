-- The Google Calendar event id for a confirmed meeting.
--
-- Without this the app can create events but never touch them again: a
-- cancelled meeting left its event in place (so the slot stayed blocked in
-- free/busy and the client kept the invite), and regenerating a Meet link
-- created a second event instead of replacing the first.
--
-- Nullable: meetings booked before this column existed have no stored id, and
-- the code treats that as "nothing to clean up" rather than an error.

alter table public.meetings
  add column if not exists google_event_id text;
