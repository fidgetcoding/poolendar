import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimit } from '@/lib/rate-limit'

type RouteParams = { params: Promise<{ id: string }> }

interface AvailabilityWindow {
  day: string
  start: string
  end: string
}

interface SlotResult {
  date: string
  slots: { start: string; end: string }[]
}

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )
}

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function getDayOfWeek(dateStr: string): string {
  // Parse as local date to get the correct day name
  const parts = dateStr.split('-').map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

function dateToTimezoneStart(dateStr: string, timezone: string): Date {
  // Create a date at midnight in the given timezone
  const dt = new Date(`${dateStr}T00:00:00`)
  const tzString = dt.toLocaleString('en-US', { timeZone: timezone })
  const utcString = dt.toLocaleString('en-US', { timeZone: 'UTC' })
  const diff = new Date(utcString).getTime() - new Date(tzString).getTime()
  return new Date(dt.getTime() + diff)
}

function timeInTimezoneToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // Build an ISO string for the given date+time in the target timezone
  const isoStr = `${dateStr}T${timeStr}:00`
  // Use Intl to resolve the timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Create the date by parsing in the timezone
  // This approach uses the temporal interpretation of the date string
  const parts = formatter.formatToParts(new Date(isoStr + 'Z'))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'

  const utcDate = new Date(isoStr + 'Z')
  const localInTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  )
  const offset = localInTz.getTime() - utcDate.getTime()
  return new Date(utcDate.getTime() - offset)
}

function generateSlotsForWindow(
  dateStr: string,
  window: AvailabilityWindow,
  durationMinutes: number,
  timezone: string
): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = []
  const windowStart = timeToMinutes(window.start)
  const windowEnd = timeToMinutes(window.end)

  let cursor = windowStart
  while (cursor + durationMinutes <= windowEnd) {
    const startUtc = timeInTimezoneToUtc(dateStr, minutesToTime(cursor), timezone)
    const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000)
    slots.push({ start: startUtc, end: endUtc })
    cursor += durationMinutes
  }

  return slots
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  const d = new Date(year, month - 1, day + days)
  return d.toISOString().split('T')[0]!
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = getServiceClient()
  const { id } = await params

  const { searchParams } = request.nextUrl
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  // Rate limit: 30 requests per minute per IP
  const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`availability:${clientIp}:${id}`, 30, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required query parameters: start, end' },
      { status: 400 }
    )
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { error: 'Date parameters must be in YYYY-MM-DD format' },
      { status: 400 }
    )
  }

  // Look up booking link
  const { data: link, error: linkError } = await supabase
    .from('booking_links')
    .select('*')
    .eq('id', id)
    .single()

  if (linkError || !link) {
    return NextResponse.json(
      { error: 'Booking link not found' },
      { status: 404 }
    )
  }

  if (!link.is_public) {
    return NextResponse.json(
      { error: 'Booking link not found' },
      { status: 404 }
    )
  }

  const timezone: string = link.timezone
  const durationMinutes: number = link.duration_minutes
  const bufferMinutes: number = link.buffer_minutes
  const minimumNoticeHours: number = link.minimum_notice_hours
  const availability: AvailabilityWindow[] = link.availability
  const bufferMs = bufferMinutes * 60 * 1000

  // Compute the full UTC range for querying conflicts
  const rangeStartUtc = timeInTimezoneToUtc(startDate, '00:00', timezone)
  const rangeEndUtc = timeInTimezoneToUtc(addDays(endDate, 1), '00:00', timezone)

  // Fetch existing bookings in range
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('booking_link_id', id)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', rangeEndUtc.toISOString())
    .gt('end_time', rangeStartUtc.toISOString())

  // Fetch host's calendar events in range
  const { data: existingEvents } = await supabase
    .from('events')
    .select('start_time, end_time')
    .eq('user_id', link.user_id)
    .lt('start_time', rangeEndUtc.toISOString())
    .gt('end_time', rangeStartUtc.toISOString())

  const blockedIntervals = [
    ...(existingBookings ?? []).map((b) => ({
      start: new Date(b.start_time).getTime() - bufferMs,
      end: new Date(b.end_time).getTime() + bufferMs,
    })),
    ...(existingEvents ?? []).map((e) => ({
      start: new Date(e.start_time).getTime() - bufferMs,
      end: new Date(e.end_time).getTime() + bufferMs,
    })),
  ]

  const now = new Date()
  const minimumStartTime = new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000)

  const results: SlotResult[] = []
  let currentDate = startDate

  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate)
    const windows = availability.filter((w) => w.day === dayOfWeek)

    const daySlots: { start: string; end: string }[] = []

    for (const window of windows) {
      const rawSlots = generateSlotsForWindow(currentDate, window, durationMinutes, timezone)

      for (const slot of rawSlots) {
        // Filter by minimum notice
        if (slot.start < minimumStartTime) continue

        // Check for conflicts with blocked intervals
        const slotStartMs = slot.start.getTime()
        const slotEndMs = slot.end.getTime()

        const hasConflict = blockedIntervals.some(
          (blocked) => slotStartMs < blocked.end && slotEndMs > blocked.start
        )

        if (!hasConflict) {
          daySlots.push({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
          })
        }
      }
    }

    results.push({ date: currentDate, slots: daySlots })
    currentDate = addDays(currentDate, 1)
  }

  return NextResponse.json(results)
}
