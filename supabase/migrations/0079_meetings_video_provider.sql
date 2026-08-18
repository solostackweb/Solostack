-- How a meeting's video link should be produced, chosen by the freelancer at
-- creation time and acted on when the client confirms a slot:
--
--   daily        in-app embedded Daily.co room (default for new meetings)
--   google_meet  Google Meet link on a real Google Calendar event
--   zoom         scheduled Zoom meeting via the Server-to-Server OAuth app
--   manual_link  the freelancer pastes their own link
--
-- Deliberately nullable with no default. NULL means "created before this
-- column existed", and the booking code falls back to the old behaviour for
-- those rows (availability bookings produced a Meet link, slot bookings a
-- Daily room), so no existing meeting changes how it behaves.

alter table public.meetings
  add column if not exists video_provider text;

alter table public.meetings
  drop constraint if exists meetings_video_provider_check;

alter table public.meetings
  add constraint meetings_video_provider_check
  check (
    video_provider is null
    or video_provider in ('daily', 'google_meet', 'zoom', 'manual_link')
  );
