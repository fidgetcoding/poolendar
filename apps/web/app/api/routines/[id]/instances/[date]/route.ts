import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../../../lib/auth/helpers'
import { z } from 'zod'

const updateInstanceSchema = z.object({
  status: z.enum(['completed', 'skipped', 'pending']).optional(),
  override_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  override_end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  override_title: z.string().max(500).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id: routineId, date } = await params

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 }
    )
  }

  // Verify the routine belongs to this user
  const { data: routine, error: routineError } = await supabase
    .from('routines')
    .select('id')
    .eq('id', routineId)
    .eq('user_id', userId)
    .single()

  if (routineError || !routine) {
    return NextResponse.json(
      { error: 'Routine not found' },
      { status: 404 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = updateInstanceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 }
    )
  }

  const input = parsed.data

  // Build the upsert row
  const row: Record<string, unknown> = {
    routine_id: routineId,
    date,
  }

  if (input.status !== undefined) {
    row.status = input.status
    if (input.status === 'completed') {
      row.completed_at = new Date().toISOString()
    } else if (input.status === 'pending') {
      row.completed_at = null
    }
  }

  if (input.override_start_time !== undefined) {
    row.override_start_time = input.override_start_time
  }
  if (input.override_end_time !== undefined) {
    row.override_end_time = input.override_end_time
  }
  if (input.override_title !== undefined) {
    row.override_title = input.override_title
  }

  // Upsert: insert on conflict (routine_id, date) update
  const { data, error } = await supabase
    .from('routine_instances')
    .upsert(row, { onConflict: 'routine_id,date' })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Failed to update routine instance' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
