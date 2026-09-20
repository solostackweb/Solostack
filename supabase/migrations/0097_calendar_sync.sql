-- =============================================================================
-- 0097_calendar_sync.sql
--
-- Google Calendar push-notification (watch channel) state + incremental sync
-- token, so edits made directly in Google Calendar flow back into Stackivo
-- meetings instead of orphaning them.
--
--   watch_channel_id   our random channel id (X-Goog-Channel-ID)
--   watch_channel_token  per-channel secret, AES-256-GCM encrypted, verified
--                        on every webhook delivery (X-Goog-Channel-Token)
--   watch_resource_id  Google's resource id for the watched calendar
--                      (X-Goog-Resource-ID, verified on delivery)
--   watch_expiration   when Google stops sending (we renew before this)
--   sync_token         events.list incremental sync token; a full reseed
--                      replaces it when Google expires it (410)
-- =============================================================================

alter table public.calendar_connections
  add column if not exists watch_channel_id text,
  add column if not exists watch_channel_token text,
  add column if not exists watch_resource_id text,
  add column if not exists watch_expiration timestamptz,
  add column if not exists sync_token text;
