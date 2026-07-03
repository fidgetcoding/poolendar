import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, isAuthError } from '@/lib/auth/helpers'
import { pullChanges } from '@/lib/google/sync'

const syncSchema = z.object({
  google_account_id: z.string().uuid(),
})

/**
 * Manual resync of a connected account. Verifies ownership under RLS, then runs
 * the incremental pull (full-window fallback when no sync_token exists yet).
 */
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

  // Ownership check under the caller's RLS client before the service-role sync.
  const { data: account, error: accountError } = await supabase
    .from('google_accounts')
    .select('id')
    .eq('id', google_account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return NextResponse.json(
      { error: 'Google account not found' },
      { status: 404 }
    )
  }

  try {
    const result = await pullChanges(google_account_id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[google/sync] pull failed:', err)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 502 }
    )
  }
}
