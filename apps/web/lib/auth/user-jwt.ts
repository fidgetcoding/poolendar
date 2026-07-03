import { SignJWT } from 'jose'
import { createServerClient } from '@supabase/ssr'
import { requireEnv } from '../env'

// ---------------------------------------------------------------------------
// API-key → user-scoped Supabase JWT.
//
// API-key callers must run under RLS as the key's user, exactly like a browser
// session. We mint a short-lived HS256 JWT signed with the project's legacy JWT
// secret and attach it as the Authorization bearer on an anon-key client, so
// PostgREST applies the user's RLS policies natively (auth.uid() = sub).
//
// There is deliberately NO service-role fallback: if the JWT secret is absent,
// we fail loudly rather than silently bypassing RLS.
// ---------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 120

function jwtSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET?.trim()
  if (!secret || secret.toLowerCase() === 'placeholder') {
    throw new Error(
      'SUPABASE_JWT_SECRET is not set — cannot mint a user-scoped token for API-key auth. ' +
        'Refusing to fall back to the service-role client, which would bypass RLS.',
    )
  }
  return secret
}

/**
 * Mint a short-lived (120s) HS256 JWT that Supabase/PostgREST accepts as the
 * given user. Claims: { sub, role: 'authenticated', aud: 'authenticated', exp }.
 */
export async function mintUserJwt(userId: string): Promise<string> {
  const key = new TextEncoder().encode(jwtSecret())
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(key)
}

/**
 * Build a Supabase client that talks to PostgREST as the user encoded in `jwt`.
 * Uses the anon key + Authorization bearer so RLS applies natively. No cookies,
 * no session — this client is per-request and never persists auth state.
 */
export function createUserScopedClient(jwt: string) {
  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      cookies: { getAll() { return [] }, setAll() {} },
    },
  )
}
