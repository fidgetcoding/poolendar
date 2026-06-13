import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../lib/auth/helpers'
import { createGoogleEvent } from '../../../lib/google/calendar'
import { createEventSchema } from '@poolendar/validators'

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { searchParams } = request.nextUrl

  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const calendarId = searchParams.get('calendar_id')

  if (!start || !end) {
    return NextResponse.json(
      { error: 'Missing required query parameters: start, end' },
      { status: 400 }
    )
  }

  let query = supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .gte('start_time', start)
    .lte('end_time', end)
    .order('start_time', { ascending: true })

  if (calendarId) {
    query = query.eq('calendar_id', calendarId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const input = parsed.data

  // Verify the calendar belongs to this user
  const { data: calendar, error: calendarError } = await supabase
    .from('calendars')
    .select('id, google_account_id, google_calendar_id')
    .eq('id', input.calendar_id)
    .eq('user_id', userId)
    .single()

  if (calendarError || !calendar) {
    return NextResponse.json(
      { error: 'Calendar not found or access denied' },
      { status: 404 }
    )
  }

  // Build the event row
  const eventRow = {
    user_id: userId,
    calendar_id: input.calendar_id,
    title: input.title,
    notes: input.notes ?? null,
    start_time: input.start_time,
    end_time: input.end_time,
    timezone: input.timezone,
    is_all_day: input.is_all_day,
    location: input.location ?? null,
    color_override: input.color_override ?? null,
    visibility: input.visibility,
    privacy: input.privacy,
    recurrence_rule: input.recurrence_rule ?? null,
    attendees: input.attendees,
    reminders: input.reminders,
    status: 'confirmed',
    sync_status: 'synced',
  }

  // Insert into Supabase first
  const { data: event, error: insertError } = await supabase
    .from('events')
    .insert(eventRow)
    .select()
    .single()

  if (insertError || !event) {
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }

  // Sync to Google Calendar
  try {
    const googleEventBody: Record<string, any> = {
      summary: input.title,
      description: input.notes ?? undefined,
      location: input.location ?? undefined,
      visibility: input.privacy === 'private' ? 'private' : 'public',
      transparency: input.visibility === 'free' ? 'transparent' : 'opaque',
    }

    if (input.is_all_day) {
      const startDate = input.start_time.split('T')[0]
      const endDate = input.end_time.split('T')[0]
      googleEventBody.start = { date: startDate, timeZone: input.timezone }
      googleEventBody.end = { date: endDate, timeZone: input.timezone }
    } else {
      googleEventBody.start = { dateTime: input.start_time, timeZone: input.timezone }
      googleEventBody.end = { dateTime: input.end_time, timeZone: input.timezone }
    }

    if (input.attendees.length > 0) {
      googleEventBody.attendees = input.attendees.map((a) => ({
        email: a.email,
        displayName: a.name,
      }))
    }

    if (input.recurrence_rule) {
      googleEventBody.recurrence = [input.recurrence_rule]
    }

    if (input.reminders.length > 0) {
      googleEventBody.reminders = {
        useDefault: false,
        overrides: input.reminders.map((r) => ({
          method: 'popup',
          minutes: r.minutes_before,
        })),
      }
    }

    const googleResult = await createGoogleEvent(
      calendar.google_account_id,
      calendar.google_calendar_id,
      googleEventBody,
      input.conferencing
    )

    // Update the local event with Google's IDs and conferencing URL
    const updateFields: Record<string, any> = {
      google_event_id: googleResult.id,
      etag: googleResult.etag,
      sync_status: 'synced',
    }

    if (googleResult.hangoutLink) {
      updateFields.conferencing_url = googleResult.hangoutLink
    }

    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateFields)
      .eq('id', event.id)
      .select()
      .single()

    if (updateError || !updatedEvent) {
      // Google sync succeeded but local update failed -- return what we have
      return NextResponse.json(
        { ...event, ...updateFields },
        { status: 201 }
      )
    }

    return NextResponse.json(updatedEvent, { status: 201 })
  } catch {
    // Google sync failed -- mark as pending and still return the event
    await supabase
      .from('events')
      .update({ sync_status: 'pending_push' })
      .eq('id', event.id)

    return NextResponse.json(
      { ...event, sync_status: 'pending_push' },
      { status: 201 }
    )
  }
}
