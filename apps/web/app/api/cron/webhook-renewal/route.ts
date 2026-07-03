// SERVICE ROLE: Required — triggered by n8n (not an authenticated user) with a
// CRON_SECRET bearer. Needs cross-user access to renew webhook channels for
// every connected account before their 7-day TTL expires.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { registerAccountWebhook } from '@/lib/google/webhooks'
import { verifyCronSecret } from '@/lib/auth/cron'
import { requireEnv } from '@/lib/env'

function getServiceClient() {
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { cookies: { getAll() { return [] }, setAll() {} } }
  )
}

/** Channels live 7 days; renew once less than this remains. */
const RENEWAL_WINDOW_MS = 24 * 60 * 60_000 // 1 day

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    let processed = 0
    const errors: string[] = []

    const { data: accounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select('id, email, webhook_channel_id, webhook_channel_expiration')

    if (accountsError) {
      return NextResponse.json(
        { error: `Failed to fetch accounts: ${accountsError.message}` },
        { status: 500 }
      )
    }

    const now = Date.now()

    for (const account of accounts ?? []) {
      // Renew when no channel exists, or when it's within the renewal window.
      const expiration = account.webhook_channel_expiration
        ? new Date(account.webhook_channel_expiration).getTime()
        : null
      const needsRenewal =
        !account.webhook_channel_id ||
        expiration === null ||
        expiration - now < RENEWAL_WINDOW_MS

      if (!needsRenewal) continue

      try {
        const registered = await registerAccountWebhook(account.id)
        if (registered) processed++
      } catch (err) {
        const msg = `Account ${account.email}: ${err instanceof Error ? err.message : 'unknown error'}`
        errors.push(msg)
        console.error('Webhook renewal failed:', msg)
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
