-- Deduplication table for cron-fired reminders.
-- The cron runs every minute; without persistent dedup, the same reminder can
-- fire on every cold-start tick until the event passes.  Rows older than 24 h
-- are cleaned up at the start of each cron run.

create table if not exists sent_reminders (
  id          uuid        primary key default gen_random_uuid(),
  dedup_key   text        unique not null,
  sent_at     timestamptz not null default now()
);

-- Fast cleanup of stale entries
create index if not exists idx_sent_reminders_sent_at
  on sent_reminders (sent_at);

-- RLS: only accessed via service-role client in cron routes.
alter table sent_reminders enable row level security;
