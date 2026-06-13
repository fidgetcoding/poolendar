import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user_id
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

  const userId = state
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
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=token_exchange_failed`
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
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=userinfo_failed`
    )
  }

  const userinfo = await userinfoResponse.json()
  const email = userinfo.email

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

  // Upsert Google account
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
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=account_save_failed`
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

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/settings?google_connected=true`
  )
}
