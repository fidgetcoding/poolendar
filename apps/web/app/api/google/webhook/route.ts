// SERVICE ROLE: Required — webhook endpoint called by Google, not by an
// authenticated user.  Needs cross-user access to google_accounts, calendars,
// and events to sync changes for any connected user.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  getGoogleAccessToken,
  googleCalendarRequest,
} from '../../../../lib/google/calendar'
import { rateLimitAsync } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Google push notifications include these headers
  const channelId = request.headers.get('x-goog-channel-id')
  const resourceId = request.headers.get('x-goog-resource-id')
  const resourceState = request.headers.get('x-goog-resource-state')
  const channelToken = request.headers.get('x-goog-channel-token')

  // Google sends a sync message on initial watch setup
  if (resourceState === 'sync') {
    return new NextResponse(null, { status: 200 })
  }

  if (!channelId || !resourceId) {
    return new NextResponse(null, { status: 400 })
  }

  // Verify the webhook shared secret
  if (!channelToken || channelToken !== process.env.GOOGLE_WEBHOOK_SECRET) {
    return new NextResponse(null, { status: 403 })
  }

  // Rate limit: 60 webhook calls per minute per channel
  if (!(await rateLimitAsync(`webhook:${channelId}`, 60, 60000))) {
    return new NextResponse(null, { status: 429 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )

  // Filter to the account that owns this webhook channel.
  // Falls back to syncing all accounts if no match (pre-migration data).
  const { data: channelAccount } = await supabase
    .from('google_accounts')
    .select('id, user_id, sync_token')
    .eq('webhook_channel_id', channelId)
    .not('sync_token', 'is', null)
    .single()

  const { data: accounts } = channelAccount
    ? { data: [channelAccount] }
    : await supabase
        .from('google_accounts')
        .select('id, user_id, sync_token')
        .not('sync_token', 'is', null)

  if (!accounts || accounts.length === 0) {
    return new NextResponse(null, { status: 200 })
  }

  for (const account of accounts) {
    try {
      const accessToken = await getGoogleAccessToken(account.id)

      const { data: calendars } = await supabase
        .from('calendars')
        .select('id, google_calendar_id')
        .eq('google_account_id', account.id)
        .eq('is_active', true)

      if (!calendars || calendars.length === 0) continue

      for (const cal of calendars) {
        try {
          const params = new URLSearchParams({
            syncToken: account.sync_token,
            maxResults: '250',
          })

          const result = await googleCalendarRequest(
            accessToken,
            `/calendars/${encodeURIComponent(cal.google_calendar_id)}/events?${params.toString()}`
          )

          if (!result) continue

          for (const item of result.items ?? []) {
            if (item.status === 'cancelled') {
              await supabase
                .from('events')
                .delete()
                .eq('google_event_id', item.id)
                .eq('user_id', account.user_id)
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
              user_id: account.user_id,
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

            const { data: existing } = await supabase
              .from('events')
              .select('id')
              .eq('google_event_id', item.id)
              .eq('user_id', account.user_id)
              .single()

            if (existing) {
              await supabase.from('events').update(eventData).eq('id', existing.id)
            } else {
              await supabase.from('events').insert(eventData)
            }
          }

          if (result.nextSyncToken) {
            await supabase
              .from('google_accounts')
              .update({
                sync_token: result.nextSyncToken,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', account.id)
          }
        } catch {
          // Individual calendar sync failure, continue with others
        }
      }
    } catch {
      // Account-level failure (e.g., token refresh failed), continue
    }
  }

  return new NextResponse(null, { status: 200 })
}
