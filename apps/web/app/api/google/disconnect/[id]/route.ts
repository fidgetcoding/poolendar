import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { authenticate, isAuthError } from '../../../../../lib/auth/helpers'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId } = auth
  const { id: accountId } = await params

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

  // Verify the google_account belongs to this user
  const { data: account, error: fetchError } = await supabase
    .from('google_accounts')
    .select('id, user_id, access_token')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !account) {
    return NextResponse.json(
      { error: 'Google account not found' },
      { status: 404 }
    )
  }

  // Revoke the Google OAuth token (best-effort; token may already be expired)
  if (account.access_token) {
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${account.access_token}`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
    } catch {
      // Token may already be expired or revoked -- continue with cleanup
    }
  }

  // Delete associated calendars first (FK dependency)
  await supabase
    .from('calendars')
    .delete()
    .eq('google_account_id', accountId)

  // Delete the google_account
  const { error: deleteError } = await supabase
    .from('google_accounts')
    .delete()
    .eq('id', accountId)

  if (deleteError) {
    return NextResponse.json(
      { error: 'Failed to delete Google account' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
