import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../lib/auth/helpers'
import { createSubtaskSchema } from '@poolendar/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { data: subtasks, error } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', id)
    .order('position', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 })
  }

  return NextResponse.json(subtasks)
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createSubtaskSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { data: maxSubtask } = await supabase
    .from('subtasks')
    .select('position')
    .eq('task_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const nextPosition = (maxSubtask?.position ?? 0) + 1.0

  const { data: subtask, error: insertError } = await supabase
    .from('subtasks')
    .insert({
      task_id: id,
      title: parsed.data.title,
      time_estimate_minutes: parsed.data.time_estimate_minutes ?? null,
      completed: false,
      position: nextPosition,
    })
    .select()
    .single()

  if (insertError || !subtask) {
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }

  return NextResponse.json(subtask, { status: 201 })
}
