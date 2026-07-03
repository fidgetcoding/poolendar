-- 011: events push-retry bookkeeping
--
-- Events whose inline Google write fails land in sync_status = 'pending_push'
-- (app/api/events/route.ts). Before this migration nothing ever re-pushed them,
-- so they stranded forever. The sync-poll cron's retry pass now re-pushes them
-- with exponential backoff, capped at 5 attempts — these columns hold that state.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Partial index for the retry scan: only pending_push rows are ever selected,
-- ordered/filtered by next_retry_at.
CREATE INDEX IF NOT EXISTS idx_events_pending_push
  ON public.events (next_retry_at)
  WHERE sync_status = 'pending_push';
