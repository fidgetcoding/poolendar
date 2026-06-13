import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { bookSlotSchema } from '@poolendar/validators'
import { createGoogleEvent } from '../../../../../lib/google/calendar'
import { rateLimit } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ slug: string }> }

interface AvailabilityWindow {
  day: string
  start: string
  end: string
}

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )
}

function getDayOfWeek(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase()
}

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

function getTimeInTimezone(date: Date, timezone: string): string {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  })
}

function isSlotWithinAvailability(
  startTime: Date,
  endTime: Date,
  availability: AvailabilityWindow[],
  timezone: string
): boolean {
  const dayOfWeek = getDayOfWeek(startTime, timezone)
  const windows = availability.filter((w) => w.day === dayOfWeek)
  if (windows.length === 0) return false

  const slotStartMinutes = timeToMinutes(getTimeInTimezone(startTime, timezone))
  const slotEndMinutes = timeToMinutes(getTimeInTimezone(endTime, timezone))

  return windows.some((w) => {
    const windowStart = timeToMinutes(w.start)
    const windowEnd = timeToMinutes(w.end)
    return slotStartMinutes >= windowStart && slotEndMinutes <= windowEnd
  })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = getServiceClient()
  const { slug } = await params

  const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`book:${clientIp}:${slug}`, 5, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { data: link, error: linkError } = await supabase
    .from('booking_links')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .limit(1)
    .single()

  if (linkError || !link) {
    return NextResponse.json({ error: 'Booking link not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bookSlotSchema.safeParse(body)
  if (!parsed.success) {
    const details: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root'
      if (!details[key]) details[key] = []
      details[key]!.push(issue.message)
    }
    return NextResponse.json({ error: 'Validation error', details }, { status: 400 })
  }

  const input = parsed.data
  const startTime = new Date(input.start_time)
  const endTime = new Date(startTime.getTime() + link.duration_minutes * 60 * 1000)
  const now = new Date()

  if (link.minimum_notice_hours > 0) {
    const minimumStart = new Date(now.getTime() + link.minimum_notice_hours * 60 * 60 * 1000)
    if (startTime < minimumStart) {
      return NextResponse.json(
        { error: `Bookings require at least ${link.minimum_notice_hours} hours notice` },
        { status: 409 }
      )
    }
  }

  if (!isSlotWithinAvailability(startTime, endTime, link.availability, link.timezone)) {
    return NextResponse.json(
      { error: 'Selected time slot is outside available hours' },
      { status: 409 }
    )
  }

  const bufferMs = link.buffer_minutes * 60 * 1000
  const bufferedStart = new Date(startTime.getTime() - bufferMs)
  const bufferedEnd = new Date(endTime.getTime() + bufferMs)

  const { data: conflictingBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('id')
    .eq('booking_link_id', link.id)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', bufferedEnd.toISOString())
    .gt('end_time', bufferedStart.toISOString())
    .limit(1)

  if (bookingsError) {
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 })
  }

  if (conflictingBookings && conflictingBookings.length > 0) {
    return NextResponse.json(
      { error: 'Selected time slot is no longer available' },
      { status: 409 }
    )
  }

  const { data: conflictingEvents, error: eventsError } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', link.user_id)
    .lt('start_time', bufferedEnd.toISOString())
    .gt('end_time', bufferedStart.toISOString())
    .limit(1)

  if (eventsError) {
    return NextResponse.json({ error: 'Failed to check calendar availability' }, { status: 500 })
  }

  if (conflictingEvents && conflictingEvents.length > 0) {
    return NextResponse.json(
      { error: 'Selected time slot conflicts with an existing event' },
      { status: 409 }
    )
  }

  const cancelToken = crypto.randomUUID()
  const status = link.requires_approval ? 'pending' : 'confirmed'

  const bookingRow = {
    booking_link_id: link.id,
    booker_name: input.booker_name,
    booker_email: input.booker_email,
    booker_notes: input.booker_notes ?? null,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status,
    cancel_token: cancelToken,
    google_event_id: null as string | null,
  }

  if (link.google_account_id && link.conferencing) {
    try {
      const { data: calendar } = await supabase
        .from('calendars')
        .select('google_calendar_id')
        .eq('google_account_id', link.google_account_id)
        .eq('user_id', link.user_id)
        .limit(1)
        .single()

      if (calendar) {
        const googleEvent = await createGoogleEvent(
          link.google_account_id,
          calendar.google_calendar_id,
          {
            summary: `${link.name} with ${input.booker_name}`,
            description: input.booker_notes ?? undefined,
            start: { dateTime: startTime.toISOString(), timeZone: link.timezone },
            end: { dateTime: endTime.toISOString(), timeZone: link.timezone },
            location: link.location ?? undefined,
            attendees: [{ email: input.booker_email }],
          },
          true
        )
        bookingRow.google_event_id = googleEvent.id
      }
    } catch {
      // Google Calendar creation failed — continue without it
    }
  }

  const { data: booking, error: insertError } = await supabase
    .from('bookings')
    .insert(bookingRow)
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23P01') {
      return NextResponse.json({ error: 'Time slot no longer available' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  const { cancel_token: _ct, ...safeBooking } = booking
  return NextResponse.json(safeBooking, { status: 201 })
}
