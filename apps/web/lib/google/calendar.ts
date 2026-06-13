import { createServerClient } from '@supabase/ssr'

interface GoogleTokens {
  access_token: string
  refresh_token: string
  token_expires_at: string
}

async function getServiceClient() {
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

async function refreshTokenIfNeeded(
  accountId: string,
  tokens: GoogleTokens
): Promise<string> {
  const expiresAt = new Date(tokens.token_expires_at)
  const now = new Date()

  if (expiresAt.getTime() - now.getTime() > 60000) {
    return tokens.access_token
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Google token')
  }

  const data = await response.json()
  const supabase = await getServiceClient()

  await supabase
    .from('google_accounts')
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(
        Date.now() + data.expires_in * 1000
      ).toISOString(),
    })
    .eq('id', accountId)

  return data.access_token
}

export async function getGoogleAccessToken(accountId: string): Promise<string> {
  const supabase = await getServiceClient()
  const { data, error } = await supabase
    .from('google_accounts')
    .select('access_token, refresh_token, token_expires_at')
    .eq('id', accountId)
    .single()

  if (error || !data) {
    throw new Error('Google account not found')
  }

  return refreshTokenIfNeeded(accountId, data)
}

export async function googleCalendarRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {}
) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Google Calendar API error: ${response.status} ${errorBody}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export async function createGoogleEvent(
  accountId: string,
  calendarId: string,
  event: {
    summary: string
    description?: string
    start: { dateTime?: string; date?: string; timeZone: string }
    end: { dateTime?: string; date?: string; timeZone: string }
    location?: string
    attendees?: { email: string }[]
    recurrence?: string[]
    reminders?: { useDefault: boolean; overrides?: { method: string; minutes: number }[] }
    visibility?: string
    transparency?: string
    conferenceData?: any
    colorId?: string
  },
  conferencing = false
) {
  const accessToken = await getGoogleAccessToken(accountId)
  const params = conferencing ? '?conferenceDataVersion=1' : ''

  if (conferencing && !event.conferenceData) {
    event.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  return googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events${params}`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  )
}

export async function updateGoogleEvent(
  accountId: string,
  calendarId: string,
  googleEventId: string,
  event: Record<string, any>
) {
  const accessToken = await getGoogleAccessToken(accountId)
  return googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(event),
    }
  )
}

export async function deleteGoogleEvent(
  accountId: string,
  calendarId: string,
  googleEventId: string
) {
  const accessToken = await getGoogleAccessToken(accountId)
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Google Calendar delete failed: ${response.status}`)
  }
}

export async function listGoogleEvents(
  accountId: string,
  calendarId: string,
  options: {
    timeMin?: string
    timeMax?: string
    syncToken?: string
    pageToken?: string
  }
) {
  const accessToken = await getGoogleAccessToken(accountId)
  const params = new URLSearchParams()
  if (options.timeMin) params.set('timeMin', options.timeMin)
  if (options.timeMax) params.set('timeMax', options.timeMax)
  if (options.syncToken) params.set('syncToken', options.syncToken)
  if (options.pageToken) params.set('pageToken', options.pageToken)
  params.set('singleEvents', 'false')
  params.set('maxResults', '250')

  return googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
  )
}

export async function watchGoogleCalendar(
  accountId: string,
  calendarId: string,
  webhookUrl: string
) {
  const accessToken = await getGoogleAccessToken(accountId)
  const channelId = crypto.randomUUID()

  return googleCalendarRequest(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: 'POST',
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        params: { ttl: '604800' }, // 7 days
      }),
    }
  )
}
