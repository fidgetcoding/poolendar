-- Performance indexes for auto-schedule queries

-- Covers the unscheduled-tasks query in auto-schedule run/preview:
--   WHERE user_id = $1 AND scheduled_start IS NULL AND status != 'done' AND is_split = false
-- Without this, Postgres falls back to idx_tasks_kanban (user_id, status, board) which
-- doesn't filter on scheduled_start or is_split, causing unnecessary row scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_unscheduled
  ON public.tasks (user_id)
  WHERE scheduled_start IS NULL AND status != 'done' AND is_split = false;

-- Covers the frame-keywords lookup in classification:
--   WHERE user_id = $1
-- The existing idx_frame_keywords_user is (user_id, keyword) which works but
-- (user_id, frame_id) is also indexed. Both are fine for the single query pattern.
-- No additional index needed for frame_keywords.
