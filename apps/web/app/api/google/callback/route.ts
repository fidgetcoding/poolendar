import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

async function hmacSign(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(process.env.GOOGLE_CLIENT_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=google_auth_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=missing_params`
    )
  }

  // Verify CSRF: split state into userId.nonce.signature
  const stateParts = state.split('.')
  if (stateParts.length !== 3) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=invalid_state`
    )
  }

  const [stateUserId, stateNonce, stateSignature] = stateParts

  // Verify the HMAC signature
  const expectedSignature = await hmacSign(`${stateUserId}.${stateNonce}`)
  if (stateSignature !== expectedSignature) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=invalid_state`
    )
  }

  // Verify the nonce matches the cookie
  const cookieNonce = request.cookies.get('oauth_state')?.value
  if (!cookieNonce || cookieNonce !== stateNonce) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=invalid_state`
    )
  }

  // Verify the user's session matches the userId in state
  const auth = await authenticate(request)
  if (isAuthError(auth) || auth.userId !== stateUserId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=session_mismatch`
    )
  }

  const userId = stateUserId
  const { supabase } = auth
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenResponse.ok) {
    console.error('[google/callback] token exchange failed:', tokenResponse.status, await tokenResponse.text().catch(() => ''))
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=token_exchange_failed`
    )
  }

  const tokens = await tokenResponse.json()

  // Get user's email from the access token
  const userinfoResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (!userinfoResponse.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=userinfo_failed`
    )
  }

  const userinfo = await userinfoResponse.json()
  const email = userinfo.email

  // Upsert Google account — uses authenticated user's session (RLS: auth.uid() = user_id)
  const { data: googleAccount, error: upsertError } = await supabase
    .from('google_accounts')
    .upsert(
      {
        user_id: userId,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: 'user_id,email' }
    )
    .select()
    .single()

  if (upsertError || !googleAccount) {
    console.error('[google/callback] google_accounts upsert failed:', upsertError?.message)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?error=account_save_failed`
    )
  }

  // Fetch calendar list from Google
  const calendarListResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )

  if (calendarListResponse.ok) {
    const calendarList = await calendarListResponse.json()

    for (const cal of calendarList.items ?? []) {
      await supabase
        .from('calendars')
        .upsert(
          {
            user_id: userId,
            google_account_id: googleAccount.id,
            google_calendar_id: cal.id,
            name: cal.summary || cal.id,
            color: cal.backgroundColor || '#4285f4',
            is_primary: cal.primary || false,
            is_active: true,
            access_role: cal.accessRole || null,
          },
          { onConflict: 'google_account_id,google_calendar_id' }
        )
    }
  }

  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/?google_connected=true`
  )

  // Delete the oauth_state cookie
  response.cookies.set('oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
