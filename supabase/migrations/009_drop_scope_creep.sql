-- Drop Frames + Auto-Scheduling scope creep
-- Reverses migrations 002 (frames/auto-schedule schema) and 003 (auto-schedule perf index).
-- These features were added against the v1 non-goals and are being removed.

-- 1. Drop the frames feature tables.
-- Cascade also removes their RLS policies, the update_frames_updated_at trigger,
-- the idx_frames_*/idx_frame_keywords_*/idx_frame_corrections_* indexes, and the
-- foreign-key constraints on tasks.frame_id / frame_keywords.frame_id / frame_corrections.*.
drop table if exists frame_corrections, frame_keywords, frames cascade;

-- 2. Drop the columns 002 added to tasks and tags.
-- Dropping these columns also removes the dependent indexes
-- idx_tasks_user_auto (tasks.auto_scheduled) and idx_tasks_user_frame (tasks.frame_id).
alter table public.tasks drop column if exists frame_id;
alter table public.tasks drop column if exists auto_scheduled;
alter table public.tags drop column if exists priority_rank;

-- 3. Drop the standalone auto-schedule performance index from migration 003.
-- It is a partial index on tasks(user_id) and is not tied to any dropped column,
-- so it must be removed explicitly.
drop index if exists idx_tasks_unscheduled;

-- 4. Restore handle_new_user() to its pre-002 form.
-- Migration 002 (section 7) injected auto_schedule_* keys into the default settings
-- JSONB for every new user. This reverts the default settings to the 001 baseline.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, username, display_name, settings)
  values (
    new.id,
    new.email,
    coalesce(
      lower(regexp_replace(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g')),
      'user' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    '{"timezone": "America/New_York", "time_format": "12h", "date_format": "MM/DD/YYYY", "first_day_of_week": "sunday", "initial_view": "week", "default_task_duration": 30, "theme_accent_color": "#6366f1", "time_drag_resolution": 15, "show_weekends": true, "show_declined_events": false, "show_completed_tasks": true, "dim_past_events": true, "undo_grace_period": 30, "background_density": "comfortable", "move_due_date_behavior": "ask", "language": "en", "time_grid_start": "06:00", "time_grid_end": "22:00", "time_display_resolution": 15, "limit_events_per_day": 4}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;
