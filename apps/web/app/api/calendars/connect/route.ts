import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '@/lib/auth/helpers'
import { getGoogleOAuthUrl } from '@/lib/google/oauth'
import { signOAuthState } from '@/lib/google/state'
import { optionalEnv } from '@/lib/env'

/**
 * POST /api/calendars/connect — returns the Google OAuth URL as JSON for
 * API/MCP callers. The browser then opens it and the shared /api/google/callback
 * completes the flow (its cookie-nonce check is skipped when no cookie is
 * present; HMAC state + session match still gate it). The browser-native GET
 * redirect variant lives at /api/google/connect.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  if (!optionalEnv('GOOGLE_CLIENT_ID') || !optionalEnv('GOOGLE_CLIENT_SECRET')) {
    return NextResponse.json(
      {
        error:
          'Google Calendar is not configured on this deployment (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET unset).',
      },
      { status: 503 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/google/callback`

  const { state } = signOAuthState(auth.userId)
  const url = getGoogleOAuthUrl(state, redirectUri)

  return NextResponse.json({ url })
}
