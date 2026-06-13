import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../../lib/auth/helpers'
import { reorderSubtasksSchema } from '@poolendar/validators'

type RouteParams = { params: Promise<{ id: string }> }

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

  const parsed = reorderSubtasksSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { subtask_ids } = parsed.data

  for (let i = 0; i < subtask_ids.length; i++) {
    const { error } = await supabase
      .from('subtasks')
      .update({ position: i + 1.0 })
      .eq('id', subtask_ids[i])
      .eq('task_id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to reorder subtasks' }, { status: 500 })
    }
  }

  const { data: subtasks, error: fetchError } = await supabase
    .from('subtasks')
    .select('*')
    .eq('task_id', id)
    .order('position', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch reordered subtasks' }, { status: 500 })
  }

  return NextResponse.json(subtasks)
}
