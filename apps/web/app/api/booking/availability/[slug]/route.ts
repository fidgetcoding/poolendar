// SERVICE ROLE: Required — public endpoint (no auth). External visitors query
// availability by slug without logging in, so there is no user session.  The
// service client bypasses RLS to read booking_links, profiles, bookings, and
// events on behalf of the link owner.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimitAsync } from '@/lib/rate-limit'

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

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0)
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function getDayOfWeek(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  const date = new Date(parts[0]!, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
}

function timeInTimezoneToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const isoStr = `${dateStr}T${timeStr}:00`
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
  const parts = formatter.formatToParts(new Date(isoStr + 'Z'))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  const utcDate = new Date(isoStr + 'Z')
  const localInTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
  )
  const offset = localInTz.getTime() - utcDate.getTime()
  return new Date(utcDate.getTime() - offset)
}

function addDaysStr(dateStr: string, days: number): string {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0]!, (parts[1] ?? 1) - 1, (parts[2] ?? 1) + days)
  return d.toISOString().split('T')[0]!
}

async function resolveSlug(supabase: ReturnType<typeof getServiceClient>, slug: string) {
  const { data, error } = await supabase
    .from('booking_links')
    .select('*, profiles!inner(id, username, display_name, avatar_url, settings)')
    .eq('slug', slug)
    .eq('is_public', true)
    .limit(1)
    .single()

  if (error || !data) return null
  return data
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = getServiceClient()
  const { slug } = await params

  const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!(await rateLimitAsync(`booking-avail:${clientIp}:${slug}`, 30, 60000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const link = await resolveSlug(supabase, slug)
  if (!link) {
    return NextResponse.json({ error: 'Booking link not found' }, { status: 404 })
  }

  const { searchParams } = request.nextUrl
  const info = searchParams.get('info')

  if (info === 'true') {
    const profile = link.profiles as {
      id: string
      display_name: string | null
      avatar_url: string | null
      settings: Record<string, unknown> | null
    }
    const settings = (profile.settings ?? {}) as Record<string, unknown>

    const { profiles: _p, ...bookingLink } = link
    return NextResponse.json({
      booking_link: bookingLink,
      host: {
        display_name: profile.display_name || 'Host',
        avatar_url: profile.avatar_url,
        booking_page_title: (settings.booking_page_title as string) ?? null,
        booking_page_brand_color: (settings.booking_page_brand_color as string) ?? null,
        booking_page_logo_url: (settings.booking_page_logo_url as string) ?? null,
      },
    })
  }

  const dateParam = searchParams.get('date')
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')
  const timezoneParam = searchParams.get('timezone')

  const startDate = dateParam ?? startParam
  const endDate = dateParam ?? endParam

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required query parameters: date (or start+end)' },
      { status: 400 }
    )
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json(
      { error: 'Date parameters must be in YYYY-MM-DD format' },
      { status: 400 }
    )
  }

  const startMs = new Date(startDate).getTime()
  const endMs = new Date(endDate).getTime()
  const MAX_RANGE_DAYS = 90
  if (isNaN(startMs) || isNaN(endMs) || endMs < startMs || (endMs - startMs) > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json(
      { error: `Date range must not exceed ${MAX_RANGE_DAYS} days` },
      { status: 400 }
    )
  }

  const timezone: string = timezoneParam ?? link.timezone
  const durationMinutes: number = link.duration_minutes
  const bufferMinutes: number = link.buffer_minutes
  const minimumNoticeHours: number = link.minimum_notice_hours
  const availability: AvailabilityWindow[] = link.availability
  const bufferMs = bufferMinutes * 60 * 1000

  const rangeStartUtc = timeInTimezoneToUtc(startDate, '00:00', timezone)
  const rangeEndUtc = timeInTimezoneToUtc(addDaysStr(endDate, 1), '00:00', timezone)

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('booking_link_id', link.id)
    .in('status', ['confirmed', 'pending'])
    .lt('start_time', rangeEndUtc.toISOString())
    .gt('end_time', rangeStartUtc.toISOString())

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

  const allSlots: { start: string; end: string }[] = []
  let currentDate = startDate

  while (currentDate <= endDate) {
    const dayOfWeek = getDayOfWeek(currentDate)
    const windows = availability.filter((w) => w.day === dayOfWeek)

    for (const window of windows) {
      const windowStart = timeToMinutes(window.start)
      const windowEnd = timeToMinutes(window.end)
      let cursor = windowStart

      while (cursor + durationMinutes <= windowEnd) {
        const slotStart = timeInTimezoneToUtc(currentDate, minutesToTime(cursor), timezone)
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)

        if (slotStart >= minimumStartTime) {
          const slotStartMs = slotStart.getTime()
          const slotEndMs = slotEnd.getTime()
          const hasConflict = blockedIntervals.some(
            (blocked) => slotStartMs < blocked.end && slotEndMs > blocked.start
          )
          if (!hasConflict) {
            allSlots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() })
          }
        }
        cursor += durationMinutes
      }
    }
    currentDate = addDaysStr(currentDate, 1)
  }

  if (dateParam) {
    return NextResponse.json({ slots: allSlots })
  }

  return NextResponse.json(allSlots)
}
