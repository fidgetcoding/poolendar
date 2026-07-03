import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '@/lib/auth/helpers'
import { getGoogleOAuthUrl } from '@/lib/google/oauth'
import { signOAuthState } from '@/lib/google/state'
import { optionalEnv } from '@/lib/env'

/**
 * Browser GET redirect into Google's OAuth consent screen. Signs an HMAC state,
 * binds its nonce to an httpOnly cookie, then 302s to Google. The JSON
 * equivalent for API/MCP callers is POST /api/calendars/connect.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  // Fail clearly instead of bouncing the user through a broken Google screen.
  if (!optionalEnv('GOOGLE_CLIENT_ID') || !optionalEnv('GOOGLE_CLIENT_SECRET')) {
    return NextResponse.json(
      {
        error:
          'Google Calendar is not configured on this deployment (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET unset).',
      },
      { status: 503 }
    )
  }

  const { userId } = auth
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/google/callback`

  const { state, nonce } = signOAuthState(userId)
  const authUrl = getGoogleOAuthUrl(state, redirectUri)

  const response = NextResponse.redirect(authUrl)
  response.cookies.set('oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
