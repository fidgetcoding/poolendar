import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

// ---------------------------------------------------------------------------
// HMAC-signed OAuth `state` for the Google Connect flow.
//
// Wire format:  <userId>.<nonce>.<hmac_hex>
//
// The HMAC is keyed on GOOGLE_CLIENT_SECRET, so an attacker cannot forge a
// state for a userId they don't control. The callback additionally verifies
// that the completing session's userId matches the one embedded here, which
// is what actually stops login-CSRF. The browser GET flow also binds `nonce`
// to an httpOnly cookie for replay protection; the JSON/MCP flow (which can't
// set that cookie in the completing browser) relies on the HMAC + session
// match instead.
// ---------------------------------------------------------------------------

function stateHmacKey(): string | null {
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!secret || !secret.trim() || secret.trim().toLowerCase() === 'placeholder') {
    return null
  }
  return secret
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex')
}

/**
 * Build a signed state string plus the nonce the GET flow stores as a cookie.
 * Throws when GOOGLE_CLIENT_SECRET is unavailable — callers must 503 before
 * reaching this point.
 */
export function signOAuthState(userId: string): { state: string; nonce: string } {
  const key = stateHmacKey()
  if (!key) {
    throw new Error('GOOGLE_CLIENT_SECRET is required to sign the OAuth state')
  }
  const nonce = randomUUID()
  const payload = `${userId}.${nonce}`
  return { state: `${payload}.${sign(payload, key)}`, nonce }
}

/**
 * Verify a state string. Returns the embedded { userId, nonce } on success, or
 * null when the format is wrong, the signature fails, or no signing key exists.
 */
export function verifyOAuthState(
  state: string
): { userId: string; nonce: string } | null {
  const key = stateHmacKey()
  if (!key) return null

  const parts = state.split('.')
  if (parts.length !== 3) return null

  const [userId, nonce, signature] = parts as [string, string, string]
  const expected = sign(`${userId}.${nonce}`, key)

  const provided = Buffer.from(signature, 'hex')
  const wanted = Buffer.from(expected, 'hex')
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return null
  }

  return { userId, nonce }
}
