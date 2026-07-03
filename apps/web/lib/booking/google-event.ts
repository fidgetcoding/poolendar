// Shared "create the Google Calendar event for a confirmed booking" step, used
// by the book route (auto-confirm) and the approve route. Returns the created
// Google event id, or null when there is no connected calendar / conferencing
// is off / the Google call fails (booking proceeds without a Google event).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createGoogleEvent } from '../google/calendar'

interface EventLink {
  user_id: string
  google_account_id: string | null
  conferencing: boolean
  name: string
  location: string | null
  timezone: string
}

interface EventBooking {
  booker_name: string
  booker_email: string
  booker_notes: string | null
  start_time: string
  end_time: string
}

export async function createBookingGoogleEvent(
  supabase: SupabaseClient,
  link: EventLink,
  booking: EventBooking
): Promise<string | null> {
  if (!link.google_account_id || !link.conferencing) return null

  try {
    const { data: calendar } = await supabase
      .from('calendars')
      .select('google_calendar_id')
      .eq('google_account_id', link.google_account_id)
      .eq('user_id', link.user_id)
      .limit(1)
      .single()

    if (!calendar) return null

    const googleEvent = await createGoogleEvent(
      link.google_account_id,
      calendar.google_calendar_id,
      {
        summary: `${link.name} with ${booking.booker_name}`,
        description: booking.booker_notes ?? undefined,
        start: { dateTime: booking.start_time, timeZone: link.timezone },
        end: { dateTime: booking.end_time, timeZone: link.timezone },
        location: link.location ?? undefined,
        attendees: [{ email: booking.booker_email }],
      },
      true
    )
    return googleEvent.id
  } catch {
    return null
  }
}
