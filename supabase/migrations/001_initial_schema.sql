-- Poolendar initial schema
-- 12 tables, RLS on all

-- 1. Profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  company text,
  avatar_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Google accounts
create table public.google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, email)
);
alter table public.google_accounts enable row level security;
create policy "Users manage own google accounts" on public.google_accounts
  for all using (auth.uid() = user_id);

-- 3. Calendars
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_account_id uuid not null references public.google_accounts(id) on delete cascade,
  google_calendar_id text not null,
  name text not null,
  color text not null,
  is_primary boolean default false,
  is_active boolean default true,
  access_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(google_account_id, google_calendar_id)
);
alter table public.calendars enable row level security;
create policy "Users manage own calendars" on public.calendars
  for all using (auth.uid() = user_id);

-- 4. Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  google_event_id text,
  title text not null,
  notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text default 'America/New_York',
  is_all_day boolean default false,
  location text,
  color_override text,
  visibility text default 'busy',
  privacy text default 'public',
  conferencing_url text,
  recurrence_rule text,
  recurrence_id text,
  attendees jsonb default '[]'::jsonb,
  reminders jsonb default '[]'::jsonb,
  status text default 'confirmed',
  sync_status text default 'synced',
  etag text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.events enable row level security;
create policy "Users manage own events" on public.events
  for all using (auth.uid() = user_id);
create index idx_events_time on public.events (user_id, start_time, end_time);
create index idx_events_google on public.events (google_event_id);
create index idx_events_sync on public.events (user_id, sync_status) where sync_status != 'synced';

-- 5. Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_id uuid references public.calendars(id),
  parent_id uuid references public.tasks(id) on delete set null,
  title text not null,
  notes text,
  importance text default 'normal',
  time_estimate_minutes int,
  earliest_start date,
  due_date date,
  due_date_recurrence text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  location text,
  visibility text default 'busy',
  privacy text default 'private',
  flexibility text default 'flexible',
  status text default 'backlog',
  board text default 'current',
  is_split boolean default false,
  completed_at timestamptz,
  position float8,
  reminders jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.tasks enable row level security;
create policy "Users manage own tasks" on public.tasks
  for all using (auth.uid() = user_id);
create index idx_tasks_kanban on public.tasks (user_id, status, board);
create index idx_tasks_parent on public.tasks (parent_id);
create index idx_tasks_scheduled on public.tasks (user_id, scheduled_start, scheduled_end)
  where scheduled_start is not null;
create index idx_tasks_due on public.tasks (user_id, due_date) where due_date is not null;

-- 6. Subtasks
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  time_estimate_minutes int,
  completed boolean default false,
  position float8 not null,
  created_at timestamptz default now()
);
alter table public.subtasks enable row level security;
create policy "Users manage subtasks via task ownership" on public.subtasks
  for all using (
    exists (select 1 from public.tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );
create index idx_subtasks_task on public.subtasks (task_id, position);

-- 7. Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null,
  prefix text,
  created_at timestamptz default now(),
  unique(user_id, name)
);
alter table public.tags enable row level security;
create policy "Users manage own tags" on public.tags
  for all using (auth.uid() = user_id);

-- 8. Task-Tag join
create table public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);
alter table public.task_tags enable row level security;
create policy "Users manage task tags via task ownership" on public.task_tags
  for all using (
    exists (select 1 from public.tasks where tasks.id = task_tags.task_id and tasks.user_id = auth.uid())
  );

-- 9. Routines
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_id uuid references public.calendars(id),
  title text not null,
  notes text,
  start_time time not null,
  end_time time not null,
  timezone text default 'America/New_York',
  recurrence_rule text not null,
  location text,
  visibility text default 'busy',
  privacy text default 'private',
  reminders jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.routines enable row level security;
create policy "Users manage own routines" on public.routines
  for all using (auth.uid() = user_id);

-- 10. Routine instances
create table public.routine_instances (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  date date not null,
  status text default 'pending',
  completed_at timestamptz,
  override_start_time time,
  override_end_time time,
  override_title text,
  unique(routine_id, date)
);
alter table public.routine_instances enable row level security;
create policy "Users manage routine instances via routine ownership" on public.routine_instances
  for all using (
    exists (select 1 from public.routines where routines.id = routine_instances.routine_id and routines.user_id = auth.uid())
  );
create index idx_routine_instances on public.routine_instances (routine_id, date);

-- 11. Booking links
create table public.booking_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  name text not null,
  duration_minutes int not null,
  availability jsonb not null,
  timezone text default 'America/New_York',
  google_account_id uuid references public.google_accounts(id),
  conferencing boolean default true,
  location text,
  notes text,
  is_public boolean default true,
  requires_approval boolean default false,
  buffer_minutes int default 0,
  minimum_notice_hours int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, slug)
);
alter table public.booking_links enable row level security;
create policy "Users manage own booking links" on public.booking_links
  for all using (auth.uid() = user_id);
create policy "Public can read public booking links" on public.booking_links
  for select using (is_public = true);

-- 12. Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_link_id uuid not null references public.booking_links(id) on delete cascade,
  booker_name text not null,
  booker_email text not null,
  booker_notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'confirmed',
  google_event_id text,
  cancel_token text unique default gen_random_uuid(),
  created_at timestamptz default now()
);
alter table public.bookings enable row level security;
create policy "Booking link owners read bookings" on public.bookings
  for select using (
    exists (select 1 from public.booking_links where booking_links.id = bookings.booking_link_id and booking_links.user_id = auth.uid())
  );
create policy "Public can create bookings" on public.bookings
  for insert with check (true);
create policy "Public can read own bookings by cancel token" on public.bookings
  for select using (true);
create index idx_bookings_time on public.bookings (booking_link_id, start_time, end_time);

-- 13. API keys
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz default now()
);
alter table public.api_keys enable row level security;
create policy "Users manage own api keys" on public.api_keys
  for all using (auth.uid() = user_id);

-- 14. Schedules (placeholder for future auto-scheduling)
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  time_blocks jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.schedules enable row level security;
create policy "Users manage own schedules" on public.schedules
  for all using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles for each row execute procedure public.update_updated_at();
create trigger update_calendars_updated_at before update on public.calendars for each row execute procedure public.update_updated_at();
create trigger update_events_updated_at before update on public.events for each row execute procedure public.update_updated_at();
create trigger update_tasks_updated_at before update on public.tasks for each row execute procedure public.update_updated_at();
create trigger update_routines_updated_at before update on public.routines for each row execute procedure public.update_updated_at();
create trigger update_booking_links_updated_at before update on public.booking_links for each row execute procedure public.update_updated_at();
create trigger update_schedules_updated_at before update on public.schedules for each row execute procedure public.update_updated_at();
