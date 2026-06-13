// SERVICE ROLE: Required — cron job runs unauthenticated (Vercel Cron),
// needs cross-user access to google_accounts to find stale accounts and
// trigger incremental sync for each.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { pullChanges } from '@/lib/google/sync'
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

/** Accounts not synced within this window are considered stale. */
const STALE_THRESHOLD_MINUTES = 10

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    let processed = 0
    const errors: string[] = []

    const staleThreshold = new Date(
      Date.now() - STALE_THRESHOLD_MINUTES * 60_000
    ).toISOString()

    // Find accounts that haven't synced recently.
    // This covers two cases:
    // 1. Webhook didn't fire (network issue, channel expired silently)
    // 2. Account was just connected and hasn't synced yet
    const { data: staleAccounts, error: queryError } = await supabase
      .from('google_accounts')
      .select('id, email, last_synced_at')
      .or(`last_synced_at.is.null,last_synced_at.lt.${staleThreshold}`)

    if (queryError) {
      return NextResponse.json(
        { error: `Failed to query accounts: ${queryError.message}` },
        { status: 500 }
      )
    }

    if (!staleAccounts || staleAccounts.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    for (const account of staleAccounts) {
      try {
        const result = await pullChanges(account.id)

        // pullChanges already updates last_synced_at and sync_token
        // via the sync engine, so no additional update needed here.

        console.log(
          `Sync poll: ${account.email} - created=${result.created}, updated=${result.updated}, deleted=${result.deleted}`
        )
        processed++
      } catch (err) {
        const msg = `Account ${account.email}: ${err instanceof Error ? err.message : 'unknown error'}`
        errors.push(msg)
        console.error('Sync poll failed:', msg)
        // Continue processing other accounts
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    console.error('Cron sync-poll error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
