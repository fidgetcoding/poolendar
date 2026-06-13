-- Rate-limit backing store for serverless environments.
-- A sliding-window counter keyed by an arbitrary string (e.g. "book:<ip>:<slug>").
-- On each request the caller UPSERTs the row; if the window has elapsed, the
-- counter resets.  Old rows are garbage-collected by a periodic index-only scan.

create table if not exists rate_limit_entries (
  key            text        primary key,
  count          int         not null default 1,
  window_start   timestamptz not null default now()
);

-- Allow fast cleanup of expired windows
create index if not exists idx_rate_limit_entries_window_start
  on rate_limit_entries (window_start);

-- RLS: this table is only accessed via the service-role client (serverless
-- API routes). No user-facing access is needed.
alter table rate_limit_entries enable row level security;
