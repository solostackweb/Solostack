-- Private meeting notes: agenda, outcomes, and follow-ups the freelancer keeps
-- for themselves. Distinct from `notes`, which is the brief the *client* reads
-- on the public booking page — the two must never be confused, so they stay
-- separate columns rather than one field with a visibility flag.
--
-- Nullable, no default. Existing meetings simply have none.

alter table public.meetings
  add column if not exists private_notes text;
