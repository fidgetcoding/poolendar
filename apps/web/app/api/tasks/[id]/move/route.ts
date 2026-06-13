import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../lib/auth/helpers'
import { moveTaskSchema } from '@poolendar/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = moveTaskSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { status, board, position } = parsed.data

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  const updateFields: Record<string, any> = { status }

  if (board !== undefined) {
    updateFields.board = board
  }
  if (position !== undefined) {
    updateFields.position = position
  }

  // Handle completed_at transitions
  if (status === 'done' && existing.status !== 'done') {
    updateFields.completed_at = new Date().toISOString()
  } else if (status !== 'done' && existing.status === 'done') {
    updateFields.completed_at = null
  }

  const { data: task, error: updateError } = await supabase
    .from('tasks')
    .update(updateFields)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (updateError || !task) {
    return NextResponse.json(
      { error: 'Failed to move task' },
      { status: 500 }
    )
  }

  return NextResponse.json(task)
}
