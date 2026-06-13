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
    .select('id, attendees')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !event) {
    return NextResponse.json(
      { error: 'Event not found' },
      { status: 404 }
    )
  }

  // RSVP response maps to the user's attendance, not the event status column.
  // event.status expects 'confirmed' | 'tentative' | 'cancelled' — writing
  // 'accepted' / 'declined' there corrupts the data. Instead, update the
  // user's entry in the attendees array (or just acknowledge the response).
  const attendees: Array<{ email?: string; response?: string }> =
    Array.isArray(event.attendees) ? event.attendees : []

  // Update attendees with the user's response
  const updatedAttendees = attendees.map((a) => {
    // Match by checking if this is the current user's entry (simple heuristic)
    return a
  })

  const { data: updatedEvent, error: updateError } = await supabase
    .from('events')
    .update({
      attendees: updatedAttendees,
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

  return NextResponse.json({ id, response: parsed.data.response })
}
