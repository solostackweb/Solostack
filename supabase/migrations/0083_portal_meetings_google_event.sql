-- Portal meetings now run on the same rails as every other meeting: accepting
-- a client's request creates a real Google Calendar event with a Meet link,
-- rather than the owner pasting a link by hand.
--
-- Storing the event id is what makes decline / cancel / complete able to clean
-- the event up later; without it the calendar drifts out of sync exactly the
-- way the main meetings table did before 0082.

alter table public.portal_meetings
  add column if not exists google_event_id text;
