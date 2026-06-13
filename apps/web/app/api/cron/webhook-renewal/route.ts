import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { watchGoogleCalendar, getGoogleAccessToken } from '@/lib/google/calendar'
import { verifyCronSecret } from '@/lib/auth/cron'

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

/** Webhook TTL is 7 days; renew when less than 1 day remains. */
const RENEWAL_THRESHOLD_MS = 6 * 24 * 60 * 60_000 // 6 days

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    let processed = 0
    const errors: string[] = []

    // Fetch all Google accounts with their calendars
    const { data: accounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select(`
        id,
        user_id,
        email,
        webhook_channel_id,
        webhook_channel_expiration,
        calendars!inner (id, google_calendar_id, is_active)
      `)

    if (accountsError) {
      return NextResponse.json(
        { error: `Failed to fetch accounts: ${accountsError.message}` },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/webhook`
    const now = new Date()

    for (const account of accounts) {
      try {
        // Determine if renewal is needed:
        // 1. No channel registered yet
        // 2. Channel expiration is within the renewal threshold (< 1 day remaining)
        const expiration = account.webhook_channel_expiration
          ? new Date(account.webhook_channel_expiration)
          : null
        const needsRenewal = !expiration
          || (expiration.getTime() - now.getTime()) < (24 * 60 * 60_000)

        // Also renew if the channel has been alive for 6+ days
        // (handles cases where expiration field is missing or stale)
        const channelAge = expiration
          ? now.getTime() - (expiration.getTime() - 7 * 24 * 60 * 60_000)
          : Infinity
        const isStale = channelAge >= RENEWAL_THRESHOLD_MS

        if (!needsRenewal && !isStale) {
          continue
        }

        // Find the primary active calendar for this account.
        // Google webhooks are per-calendar; we watch the primary calendar
        // and rely on sync to pull changes across all calendars.
        const calendars = (account as any).calendars as Array<{
          id: string
          google_calendar_id: string
          is_active: boolean
        }>
        const activeCalendars = calendars.filter((c) => c.is_active)

        if (activeCalendars.length === 0) {
          continue
        }

        // Stop the old channel if one exists (best-effort)
        if (account.webhook_channel_id) {
          try {
            const accessToken = await getGoogleAccessToken(account.id)
            await fetch(
              'https://www.googleapis.com/calendar/v3/channels/stop',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: account.webhook_channel_id,
                  resourceId: account.webhook_channel_id,
                }),
              }
            )
          } catch {
            // Stopping the old channel is best-effort
          }
        }

        // Register a new webhook for the first active calendar
        // (Google's watch notifies on any change to the calendar)
        const primaryCal = activeCalendars[0]!
        const watchResult = await watchGoogleCalendar(
          account.id,
          primaryCal.google_calendar_id,
          webhookUrl
        )

        // Store the new channel info
        const expirationMs = watchResult.expiration
          ? parseInt(watchResult.expiration, 10)
          : Date.now() + 7 * 24 * 60 * 60_000

        await supabase
          .from('google_accounts')
          .update({
            webhook_channel_id: watchResult.id,
            webhook_channel_expiration: new Date(expirationMs).toISOString(),
          })
          .eq('id', account.id)

        processed++
      } catch (err) {
        const msg = `Account ${account.email}: ${err instanceof Error ? err.message : 'unknown error'}`
        errors.push(msg)
        console.error('Webhook renewal failed:', msg)
        // Continue processing other accounts
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    console.error('Cron webhook-renewal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
