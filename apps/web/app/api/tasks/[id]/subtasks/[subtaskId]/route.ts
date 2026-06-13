import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../../lib/auth/helpers'
import { updateSubtaskSchema } from '@poolendar/validators'

type RouteParams = { params: Promise<{ id: string; subtaskId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id, subtaskId } = await params

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

  const parsed = updateSubtaskSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { data: subtask, error } = await supabase
    .from('subtasks')
    .update(parsed.data)
    .eq('id', subtaskId)
    .eq('task_id', id)
    .select()
    .single()

  if (error || !subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  return NextResponse.json(subtask)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id, subtaskId } = await params

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('subtasks')
    .delete()
    .eq('id', subtaskId)
    .eq('task_id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
