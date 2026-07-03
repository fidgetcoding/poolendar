-- 013: transactional task writes via Postgres functions
--
-- Task create (task + tags + subtasks) and task split (children + tags +
-- subtask cleanup + parent flip) each touch several tables. Done as separate
-- statements from a route handler, a mid-sequence failure leaves a half-written
-- task (tags attached to a task with no subtasks, a parent marked is_split with
-- no children, etc.). Wrapping the writes in a function makes each an atomic
-- transaction.
--
-- SECURITY INVOKER: the functions run as the calling role (authenticated) with
-- the caller's auth.uid(), so the same per-row RLS policies that guard direct
-- table access still apply. No privilege escalation, no service-role bypass.
-- Row ownership is enforced by RLS (INSERT with_check auth.uid() = user_id);
-- the functions set user_id := auth.uid() and never trust a caller-supplied one.

-- ---------------------------------------------------------------------------
-- create_task_with_children(p_task, p_tag_ids, p_subtasks)
--   p_task     : jsonb of task columns (title, notes, calendar_id, importance,
--                time_estimate_minutes, earliest_start, due_date,
--                due_date_recurrence, scheduled_start, scheduled_end, location,
--                visibility, privacy, flexibility, status, board, reminders)
--   p_tag_ids  : uuid[] of already-ownership-checked tag ids
--   p_subtasks : jsonb array of { title, time_estimate_minutes? }
-- Returns the created task as jsonb with `tags` and `subtasks` embedded.
-- ---------------------------------------------------------------------------
create or replace function public.create_task_with_children(
  p_task jsonb,
  p_tag_ids uuid[] default '{}',
  p_subtasks jsonb default '[]'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.tasks;
  v_status text := coalesce(p_task->>'status', 'backlog');
  v_tags jsonb;
  v_subtasks jsonb;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'PT401';
  end if;

  insert into public.tasks (
    user_id, title, notes, calendar_id, importance, time_estimate_minutes,
    earliest_start, due_date, due_date_recurrence, scheduled_start, scheduled_end,
    location, visibility, privacy, flexibility, status, board, reminders, completed_at
  ) values (
    v_user_id,
    p_task->>'title',
    p_task->>'notes',
    (p_task->>'calendar_id')::uuid,
    coalesce(p_task->>'importance', 'normal'),
    (p_task->>'time_estimate_minutes')::int,
    (p_task->>'earliest_start')::date,
    (p_task->>'due_date')::date,
    p_task->>'due_date_recurrence',
    (p_task->>'scheduled_start')::timestamptz,
    (p_task->>'scheduled_end')::timestamptz,
    p_task->>'location',
    coalesce(p_task->>'visibility', 'busy'),
    coalesce(p_task->>'privacy', 'private'),
    coalesce(p_task->>'flexibility', 'flexible'),
    v_status,
    coalesce(p_task->>'board', 'current'),
    coalesce(p_task->'reminders', '[]'::jsonb),
    case when v_status = 'done' then now() else null end
  )
  returning * into v_task;

  if array_length(p_tag_ids, 1) is not null then
    insert into public.task_tags (task_id, tag_id)
    select v_task.id, unnest(p_tag_ids);
  end if;

  if jsonb_typeof(p_subtasks) = 'array' and jsonb_array_length(p_subtasks) > 0 then
    insert into public.subtasks (task_id, title, time_estimate_minutes, completed, position)
    select
      v_task.id,
      elem->>'title',
      (elem->>'time_estimate_minutes')::int,
      false,
      ord::float8
    from jsonb_array_elements(p_subtasks) with ordinality as t(elem, ord);
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', tg.id, 'name', tg.name, 'color', tg.color, 'prefix', tg.prefix)),
    '[]'::jsonb
  )
    into v_tags
  from public.task_tags tt
  join public.tags tg on tg.id = tt.tag_id
  where tt.task_id = v_task.id;

  select coalesce(jsonb_agg(to_jsonb(s.*) order by s.position), '[]'::jsonb)
    into v_subtasks
  from public.subtasks s
  where s.task_id = v_task.id;

  return to_jsonb(v_task) || jsonb_build_object('tags', v_tags, 'subtasks', v_subtasks);
end;
$$;

-- ---------------------------------------------------------------------------
-- split_task(p_parent_id, p_children, p_tag_ids, p_delete_subtasks)
--   p_children : jsonb array of child rows the route has already computed
--                (title, notes, calendar_id, importance, time_estimate_minutes,
--                 earliest_start, due_date, status, board, visibility, privacy,
--                 flexibility, reminders, completed_at, position)
--   p_tag_ids  : uuid[] parent tags to copy onto every child
--   p_delete_subtasks : whether the children came from subtasks (delete them)
-- Atomically inserts the children, copies tags, clears source subtasks, and
-- flips the parent to is_split (clearing its schedule so only children render,
-- spec #23e). Returns { parent, children }.
-- ---------------------------------------------------------------------------
create or replace function public.split_task(
  p_parent_id uuid,
  p_children jsonb,
  p_tag_ids uuid[] default '{}',
  p_delete_subtasks boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent public.tasks;
  v_children jsonb;
  v_child_ids uuid[];
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'PT401';
  end if;

  with inserted as (
    insert into public.tasks (
      user_id, parent_id, calendar_id, title, notes, importance,
      time_estimate_minutes, earliest_start, due_date, status, board,
      visibility, privacy, flexibility, reminders, completed_at, position, is_split
    )
    select
      v_user_id,
      p_parent_id,
      (c->>'calendar_id')::uuid,
      c->>'title',
      c->>'notes',
      coalesce(c->>'importance', 'normal'),
      (c->>'time_estimate_minutes')::int,
      (c->>'earliest_start')::date,
      (c->>'due_date')::date,
      coalesce(c->>'status', 'backlog'),
      coalesce(c->>'board', 'current'),
      coalesce(c->>'visibility', 'busy'),
      coalesce(c->>'privacy', 'private'),
      coalesce(c->>'flexibility', 'flexible'),
      coalesce(c->'reminders', '[]'::jsonb),
      (c->>'completed_at')::timestamptz,
      (c->>'position')::float8,
      false
    from jsonb_array_elements(p_children) as c
    returning *
  )
  select coalesce(jsonb_agg(to_jsonb(inserted.*) order by inserted.position), '[]'::jsonb),
         array_agg(inserted.id)
    into v_children, v_child_ids
  from inserted;

  if array_length(p_tag_ids, 1) is not null and array_length(v_child_ids, 1) is not null then
    insert into public.task_tags (task_id, tag_id)
    select cid, tid
    from unnest(v_child_ids) as cid
    cross join unnest(p_tag_ids) as tid;
  end if;

  if p_delete_subtasks then
    delete from public.subtasks where task_id = p_parent_id;
  end if;

  update public.tasks
    set is_split = true, scheduled_start = null, scheduled_end = null
    where id = p_parent_id and user_id = v_user_id
    returning * into v_parent;

  return jsonb_build_object('parent', to_jsonb(v_parent), 'children', v_children);
end;
$$;

-- Explicit execute grants (defensive; 012 also default-grants functions).
grant execute on function public.create_task_with_children(jsonb, uuid[], jsonb) to authenticated, service_role;
grant execute on function public.split_task(uuid, jsonb, uuid[], boolean) to authenticated, service_role;
