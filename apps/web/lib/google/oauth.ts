import { createServerClient } from '@supabase/ssr'
import type { GoogleAccount } from '@poolendar/types'

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

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

/**
 * Generate Google OAuth consent URL.
 * State param encodes the userId so the callback can associate the account.
 */
export function getGoogleOAuthUrl(
  userId: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange authorization code for tokens, then fetch the user's email
 * from Google's userinfo endpoint.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
  email: string
}> {
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
    const body = await tokenResponse.text()
    throw new Error(
      `Google token exchange failed: ${tokenResponse.status} ${body}`
    )
  }

  const tokenData = await tokenResponse.json()

  if (!tokenData.refresh_token) {
    throw new Error(
      'No refresh_token returned. Ensure prompt=consent and access_type=offline.'
    )
  }

  // Fetch the Google account email
  const userinfoResponse = await fetch(
    'https://www.googleapis.com/oauth2/v2/userinfo',
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }
  )

  if (!userinfoResponse.ok) {
    throw new Error('Failed to fetch Google user info')
  }

  const userinfo = await userinfoResponse.json()

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    email: userinfo.email,
  }
}

// Google Calendar API color ID to hex mapping
const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
  '1': '#795548',
  '2': '#33B679',
  '3': '#8E24AA',
  '4': '#E67C73',
  '5': '#F6BF26',
  '6': '#F4511E',
  '7': '#039BE5',
  '8': '#616161',
  '9': '#3F51B5',
  '10': '#0B8043',
  '11': '#D50000',
  '12': '#F09300',
  '13': '#009688',
  '14': '#4285F4',
  '15': '#9E69AF',
  '16': '#AD1457',
  '17': '#D81B60',
  '18': '#795548',
  '19': '#A79B8E',
  '20': '#33B679',
  '21': '#E4C441',
  '22': '#0B8043',
  '23': '#3F51B5',
  '24': '#8E24AA',
}

/**
 * Upsert a Google account and its calendars into the database.
 * Returns the google_account_id.
 */
export async function saveGoogleAccount(
  userId: string,
  tokens: {
    access_token: string
    refresh_token: string
    expires_in: number
    email: string
  }
): Promise<string> {
  const supabase = getServiceClient()
  const tokenExpiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString()

  // Upsert the google_accounts row
  const { data: account, error: accountError } = await supabase
    .from('google_accounts')
    .upsert(
      {
        user_id: userId,
        email: tokens.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
      },
      { onConflict: 'user_id,email' }
    )
    .select('id')
    .single()

  if (accountError || !account) {
    throw new Error(
      `Failed to save Google account: ${accountError?.message ?? 'unknown'}`
    )
  }

  const accountId = account.id

  // Fetch the user's calendar list from Google
  const calendarListResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  )

  if (!calendarListResponse.ok) {
    // Account is saved even if calendar fetch fails — caller can retry sync
    console.error(
      'Failed to fetch Google calendar list:',
      calendarListResponse.status
    )
    return accountId
  }

  const calendarListData = await calendarListResponse.json()
  const calendars: Array<{
    id: string
    summary: string
    backgroundColor: string
    primary?: boolean
    accessRole: string
  }> = calendarListData.items ?? []

  // Upsert each calendar
  for (const cal of calendars) {
    const color =
      cal.backgroundColor ??
      GOOGLE_CALENDAR_COLORS[cal.id] ??
      '#4285F4'

    await supabase.from('calendars').upsert(
      {
        user_id: userId,
        google_account_id: accountId,
        google_calendar_id: cal.id,
        name: cal.summary ?? cal.id,
        color,
        is_primary: cal.primary === true,
        is_active: true,
        access_role: cal.accessRole ?? null,
      },
      { onConflict: 'google_account_id,google_calendar_id' }
    )
  }

  return accountId
}

/**
 * Disconnect a Google account: revoke the token (best-effort),
 * then delete the google_accounts row (cascades to calendars + events).
 */
export async function disconnectGoogleAccount(
  accountId: string
): Promise<void> {
  const supabase = getServiceClient()

  // Fetch the token so we can revoke it
  const { data: account } = await supabase
    .from('google_accounts')
    .select('access_token, refresh_token')
    .eq('id', accountId)
    .single()

  // Best-effort token revocation — don't throw if it fails
  if (account) {
    const tokenToRevoke = account.refresh_token ?? account.access_token
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
    } catch {
      // Revocation failure is non-fatal — the token expires on its own
    }
  }

  // Delete cascades to calendars and events via FK constraints
  const { error } = await supabase
    .from('google_accounts')
    .delete()
    .eq('id', accountId)

  if (error) {
    throw new Error(`Failed to disconnect Google account: ${error.message}`)
  }
}
