import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../../lib/auth/helpers'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: 'backlog',
      completed_at: null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}
