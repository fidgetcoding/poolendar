import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'
import { getGoogleOAuthUrl } from '../../../../lib/google/oauth'

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
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId } = auth

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`

  // Generate CSRF-safe state: userId.nonce.hmac
  const nonce = crypto.randomUUID()
  const payload = `${userId}.${nonce}`
  const signature = await hmacSign(payload)
  const state = `${payload}.${signature}`

  const authUrl = getGoogleOAuthUrl(state, redirectUri)

  const response = NextResponse.redirect(authUrl)

  // Set nonce cookie for verification in the callback
  response.cookies.set('oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
