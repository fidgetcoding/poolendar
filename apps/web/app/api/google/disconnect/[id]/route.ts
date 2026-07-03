import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '@/lib/auth/helpers'
import { disconnectGoogleAccount } from '@/lib/google/oauth'

/**
 * Disconnect a Google account by its id: revoke the token (best-effort) and
 * delete the google_accounts row (cascades to calendars + events). Ownership is
 * verified under RLS before the service-role teardown runs.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id: accountId } = await params

  const { data: account, error } = await supabase
    .from('google_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (error || !account) {
    return NextResponse.json(
      { error: 'Google account not found' },
      { status: 404 }
    )
  }

  try {
    // Decrypts the stored token before revoking, then deletes with cascade.
    await disconnectGoogleAccount(accountId)
  } catch (err) {
    console.error('[google/disconnect] teardown failed:', err)
    return NextResponse.json(
      { error: 'Failed to disconnect Google account' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
