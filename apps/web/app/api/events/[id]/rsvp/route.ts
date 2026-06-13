import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../../lib/auth/helpers'
import { rsvpSchema } from '@poolendar/validators'

interface RouteParams {
  params: Promise<{ id: string }>
}

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

  const parsed = rsvpSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  // Verify the event exists and the user has access to it
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !event) {
    return NextResponse.json(
      { error: 'Event not found' },
      { status: 404 }
    )
  }

  // Update the event status with the RSVP response
  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({
      status: parsed.data.response,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updatedEvent) {
    return NextResponse.json(
      { error: 'Failed to update RSVP' },
      { status: 500 }
    )
  }

  return NextResponse.json(updatedEvent)
}
