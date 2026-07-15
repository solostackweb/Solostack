-- Booking mode for meetings: "slots" (freelancer proposes times, default) or
-- "availability" (client picks from the freelancer's live Google Calendar
-- availability). Backwards-compatible — existing rows default to "slots".

alter table public.meetings
  add column if not exists mode text not null default 'slots';
