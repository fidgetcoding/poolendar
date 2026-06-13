-- Add webhook channel tracking columns for Google Calendar push notification renewal
alter table public.google_accounts
  add column if not exists webhook_channel_id text,
  add column if not exists webhook_channel_expiration timestamptz;
