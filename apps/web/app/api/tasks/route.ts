import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../lib/auth/helpers'
import { createTaskSchema } from '@poolendar/validators'

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { searchParams } = request.nextUrl

  const status = searchParams.get('status')
  const board = searchParams.get('board')
  const parentId = searchParams.get('parent_id')

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (board) {
    query = query.eq('board', board)
  }
  if (parentId) {
    query = query.eq('parent_id', parentId)
  } else {
    query = query.is('parent_id', null)
  }

  const { data: tasks, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }

  if (tasks.length === 0) {
    return NextResponse.json([])
  }

  const taskIds = tasks.map((t) => t.id)

  const { data: taskTags, error: tagsError } = await supabase
    .from('task_tags')
    .select('task_id, tag_id, tags(id, name, color, prefix)')
    .in('task_id', taskIds)

  if (tagsError) {
    return NextResponse.json(
      { error: 'Failed to fetch task tags' },
      { status: 500 }
    )
  }

  const tagsByTaskId: Record<string, any[]> = {}
  for (const tt of taskTags ?? []) {
    if (!tagsByTaskId[tt.task_id]) {
      tagsByTaskId[tt.task_id] = []
    }
    tagsByTaskId[tt.task_id].push(tt.tags)
  }

  const tasksWithTags = tasks.map((task) => ({
    ...task,
    tags: tagsByTaskId[task.id] ?? [],
  }))

  return NextResponse.json(tasksWithTags)
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { tag_ids, subtasks, ...input } = parsed.data

  const taskRow = {
    user_id: userId,
    title: input.title,
    notes: input.notes ?? null,
    calendar_id: input.calendar_id ?? null,
    importance: input.importance,
    time_estimate_minutes: input.time_estimate_minutes ?? null,
    earliest_start: input.earliest_start ?? null,
    due_date: input.due_date ?? null,
    due_date_recurrence: input.due_date_recurrence ?? null,
    scheduled_start: input.scheduled_start ?? null,
    scheduled_end: input.scheduled_end ?? null,
    location: input.location ?? null,
    visibility: input.visibility,
    privacy: input.privacy,
    flexibility: input.flexibility,
    status: input.status,
    board: input.board,
    reminders: input.reminders,
    completed_at: input.status === 'done' ? new Date().toISOString() : null,
  }

  const { data: task, error: insertError } = await supabase
    .from('tasks')
    .insert(taskRow)
    .select()
    .single()

  if (insertError || !task) {
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }

  if (tag_ids.length > 0) {
    const tagRows = tag_ids.map((tagId) => ({
      task_id: task.id,
      tag_id: tagId,
    }))

    const { error: tagError } = await supabase
      .from('task_tags')
      .insert(tagRows)

    if (tagError) {
      return NextResponse.json(
        { error: 'Task created but failed to attach tags' },
        { status: 500 }
      )
    }
  }

  if (subtasks && subtasks.length > 0) {
    const subtaskRows = subtasks.map((st, idx) => ({
      task_id: task.id,
      title: st.title,
      time_estimate_minutes: st.time_estimate_minutes ?? null,
      completed: false,
      position: idx + 1.0,
    }))

    const { error: subtaskError } = await supabase
      .from('subtasks')
      .insert(subtaskRows)

    if (subtaskError) {
      return NextResponse.json(
        { error: 'Task created but failed to create subtasks' },
        { status: 500 }
      )
    }
  }

  // Fetch the complete task with tags
  const { data: tagRecords } = await supabase
    .from('task_tags')
    .select('tag_id, tags(id, name, color, prefix)')
    .eq('task_id', task.id)

  const { data: subtaskRecords } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', task.id)
    .order('position', { ascending: true })

  return NextResponse.json(
    {
      ...task,
      tags: (tagRecords ?? []).map((r) => r.tags),
      subtasks: subtaskRecords ?? [],
    },
    { status: 201 }
  )
}
