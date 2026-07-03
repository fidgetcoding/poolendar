import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '@/lib/auth/helpers'
import type { Calendar } from '@poolendar/types'

/**
 * GET /api/calendars — the caller's connected Google accounts, each grouped
 * with its sub-calendars. Read from the DB (cached from Google), never a live
 * Google call. User-scoped via RLS.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  const { data: accounts, error: accountsError } = await supabase
    .from('google_accounts')
    .select('id, email, token_expires_at, sync_token, last_synced_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (accountsError) {
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }

  const { data: calendars, error: calendarsError } = await supabase
    .from('calendars')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })

  if (calendarsError) {
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    )
  }

  const grouped = (accounts ?? []).map((account) => ({
    ...account,
    calendars: (calendars ?? []).filter(
      (c: Calendar) => c.google_account_id === account.id
    ),
  }))

  return NextResponse.json({ accounts: grouped })
}
