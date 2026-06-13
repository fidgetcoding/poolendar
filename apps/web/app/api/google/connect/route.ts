import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId } = auth

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  })

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
