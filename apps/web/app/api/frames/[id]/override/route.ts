import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../lib/auth/helpers'
import { frameOverrideSchema } from '@poolendar/validators'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = frameOverrideSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { date, active } = parsed.data

  const { data: frame, error: readError } = await supabase
    .from('frames')
    .select('day_overrides')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (readError || !frame) {
    return NextResponse.json(
      { error: 'Frame not found' },
      { status: 404 }
    )
  }

  const overrides = (frame.day_overrides as Record<string, boolean>) ?? {}
  if (active) {
    delete overrides[date] // Remove override = restore default (active)
  } else {
    overrides[date] = false // Skip this date
  }

  const { data, error } = await supabase
    .from('frames')
    .update({ day_overrides: overrides, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update override' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
