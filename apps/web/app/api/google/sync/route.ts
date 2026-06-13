import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'
import {
  getGoogleAccessToken,
  googleCalendarRequest,
} from '../../../../lib/google/calendar'
import { z } from 'zod'

const syncSchema = z.object({
  google_account_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { google_account_id } = parsed.data

  // Verify ownership
  const { data: account, error: accountError } = await supabase
    .from('google_accounts')
    .select('id, sync_token')
    .eq('id', google_account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
  }

  // Get all calendars for this account
  const { data: calendars } = await supabase
    .from('calendars')
    .select('id, google_calendar_id')
    .eq('google_account_id', google_account_id)
    .eq('is_active', true)

  if (!calendars || calendars.length === 0) {
    return NextResponse.json({ synced_count: 0 })
  }

  let totalSynced = 0
  const accessToken = await getGoogleAccessToken(google_account_id)

  for (const cal of calendars) {
    try {
      const params: Record<string, string> = {
        singleEvents: 'false',
        maxResults: '250',
      }

      if (account.sync_token) {
        params.syncToken = account.sync_token
      } else {
        // Initial sync: past 30 days + next 365 days
        const now = new Date()
        params.timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        params.timeMax = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }

      let pageToken: string | undefined
      let newSyncToken: string | undefined

      do {
        if (pageToken) params.pageToken = pageToken

        const queryString = new URLSearchParams(params).toString()
        const result = await googleCalendarRequest(
          accessToken,
          `/calendars/${encodeURIComponent(cal.google_calendar_id)}/events?${queryString}`
        )

        if (!result) break

        for (const item of result.items ?? []) {
          if (item.status === 'cancelled') {
            // Delete locally
            await supabase
              .from('events')
              .delete()
              .eq('google_event_id', item.id)
              .eq('user_id', userId)
            totalSynced++
            continue
          }

          const isAllDay = !!item.start?.date
          // For all-day events, store the bare date without UTC conversion
          const startTime = isAllDay
            ? `${item.start.date}T00:00:00`
            : item.start?.dateTime
          const endTime = isAllDay
            ? `${item.end.date}T00:00:00`
            : item.end?.dateTime

          if (!startTime || !endTime) continue

          const eventData = {
            user_id: userId,
            calendar_id: cal.id,
            google_event_id: item.id,
            title: item.summary || '(No title)',
            notes: item.description || null,
            start_time: startTime,
            end_time: endTime,
            timezone: item.start?.timeZone || 'America/New_York',
            is_all_day: isAllDay,
            location: item.location || null,
            visibility: item.transparency === 'transparent' ? 'free' : 'busy',
            privacy: item.visibility === 'private' ? 'private' : 'public',
            conferencing_url: item.hangoutLink || null,
            recurrence_rule: item.recurrence?.[0] || null,
            recurrence_id: item.recurringEventId || null,
            attendees: (item.attendees || []).map((a: any) => ({
              email: a.email,
              name: a.displayName,
              response_status: a.responseStatus,
            })),
            reminders: item.reminders?.overrides?.map((r: any) => ({
              minutes_before: r.minutes,
            })) || [],
            status: item.status || 'confirmed',
            sync_status: 'synced' as const,
            etag: item.etag,
          }

          // Check if event already exists
          const { data: existing } = await supabase
            .from('events')
            .select('id')
            .eq('google_event_id', item.id)
            .eq('user_id', userId)
            .single()

          if (existing) {
            await supabase
              .from('events')
              .update(eventData)
              .eq('id', existing.id)
          } else {
            await supabase
              .from('events')
              .insert(eventData)
          }

          totalSynced++
        }

        pageToken = result.nextPageToken
        if (result.nextSyncToken) {
          newSyncToken = result.nextSyncToken
        }
      } while (pageToken)

      // Store new sync token
      if (newSyncToken) {
        await supabase
          .from('google_accounts')
          .update({
            sync_token: newSyncToken,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', google_account_id)
      }
    } catch (err) {
      // If sync token is invalid, clear it and retry on next sync
      if (account.sync_token) {
        await supabase
          .from('google_accounts')
          .update({ sync_token: null })
          .eq('id', google_account_id)
      }
    }
  }

  return NextResponse.json({ synced_count: totalSynced })
}
