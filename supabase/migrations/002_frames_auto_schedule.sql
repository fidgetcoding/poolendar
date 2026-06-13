-- Frames + Auto-Scheduling
-- Adds frames, frame_keywords, frame_corrections tables and extends tasks/tags

-- 1. Frames
create table public.frames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366f1',
  time_blocks jsonb not null default '[]'::jsonb,
  recurrence_rule text,
  is_active boolean default true,
  day_overrides jsonb default '{}'::jsonb,
  priority_rank int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.frames enable row level security;
create policy "Users read own frames" on public.frames for select using (auth.uid() = user_id);
create policy "Users insert own frames" on public.frames for insert with check (auth.uid() = user_id);
create policy "Users update own frames" on public.frames for update using (auth.uid() = user_id);
create policy "Users delete own frames" on public.frames for delete using (auth.uid() = user_id);

create trigger update_frames_updated_at before update on public.frames
  for each row execute procedure public.update_updated_at();

-- 2. Frame keywords
create table public.frame_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  frame_id uuid not null references public.frames(id) on delete cascade,
  keyword text not null,
  weight float8 default 1.0,
  source text not null default 'seed',
  created_at timestamptz default now()
);
alter table public.frame_keywords enable row level security;
create policy "Users read own frame keywords" on public.frame_keywords for select using (auth.uid() = user_id);
create policy "Users insert own frame keywords" on public.frame_keywords for insert with check (auth.uid() = user_id);
create policy "Users update own frame keywords" on public.frame_keywords for update using (auth.uid() = user_id);
create policy "Users delete own frame keywords" on public.frame_keywords for delete using (auth.uid() = user_id);

-- 3. Frame corrections (learning from user reassignments)
create table public.frame_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  from_frame_id uuid references public.frames(id) on delete set null,
  to_frame_id uuid references public.frames(id) on delete set null,
  task_title text not null,
  created_at timestamptz default now()
);
alter table public.frame_corrections enable row level security;
create policy "Users read own frame corrections" on public.frame_corrections for select using (auth.uid() = user_id);
create policy "Users insert own frame corrections" on public.frame_corrections for insert with check (auth.uid() = user_id);
create policy "Users update own frame corrections" on public.frame_corrections for update using (auth.uid() = user_id);
create policy "Users delete own frame corrections" on public.frame_corrections for delete using (auth.uid() = user_id);

-- 4. Extend tasks with frame assignment + auto-schedule flag
alter table public.tasks add column frame_id uuid references public.frames(id) on delete set null;
alter table public.tasks add column auto_scheduled boolean default false;

-- 5. Extend tags with priority rank
alter table public.tags add column priority_rank int default 0;

-- 6. Indexes
create index idx_frames_user_active on public.frames(user_id, is_active);
create index idx_frame_keywords_user on public.frame_keywords(user_id, keyword);
create index idx_frame_keywords_frame on public.frame_keywords(user_id, frame_id);
create index idx_frame_corrections_user on public.frame_corrections(user_id);
create index idx_tasks_user_auto on public.tasks(user_id, auto_scheduled);
create index idx_tasks_user_frame on public.tasks(user_id, frame_id);

-- 7. Add auto-schedule defaults to new-user settings
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
    '{"timezone": "America/New_York", "time_format": "12h", "date_format": "MM/DD/YYYY", "first_day_of_week": "sunday", "initial_view": "week", "default_task_duration": 30, "theme_accent_color": "#6366f1", "time_drag_resolution": 15, "show_weekends": true, "show_declined_events": false, "show_completed_tasks": true, "dim_past_events": true, "undo_grace_period": 30, "background_density": "comfortable", "move_due_date_behavior": "ask", "language": "en", "time_grid_start": "06:00", "time_grid_end": "22:00", "time_display_resolution": 15, "limit_events_per_day": 4, "auto_schedule_enabled": false, "auto_schedule_weights": {"urgency": 0.35, "deadline": 0.30, "tag_priority": 0.20, "staleness": 0.15}, "auto_schedule_ai_enabled": false, "auto_schedule_llm_daily_cap": 100}'::jsonb
  );
  return new;
end;
$$ language plpgsql security definer;
