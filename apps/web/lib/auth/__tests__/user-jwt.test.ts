// @vitest-environment node
// jose's WebCrypto build checks `instanceof Uint8Array` against its own realm;
// jsdom's TextEncoder returns a cross-realm Uint8Array that fails that check.
// The real runtime (Node/Edge API routes) never hits this — it's jsdom-only.
import { describe, it, expect, beforeEach } from 'vitest'
import { jwtVerify } from 'jose'
import { mintUserJwt } from '../user-jwt'

const SECRET = 'test-supabase-jwt-secret-value'

describe('mintUserJwt', () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET
  })

  it('mints an HS256 JWT with the Supabase RLS claims', async () => {
    const token = await mintUserJwt('user-123')

    const { payload, protectedHeader } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
      { audience: 'authenticated' },
    )

    expect(protectedHeader.alg).toBe('HS256')
    expect(payload.sub).toBe('user-123')
    expect(payload.role).toBe('authenticated')
    expect(payload.aud).toBe('authenticated')
    expect(typeof payload.exp).toBe('number')
    expect(typeof payload.iat).toBe('number')
    // Short-lived: ~120s TTL.
    expect(payload.exp! - payload.iat!).toBe(120)
  })

  it('is rejected by jwtVerify under a different secret', async () => {
    const token = await mintUserJwt('user-x')
    await expect(
      jwtVerify(token, new TextEncoder().encode('wrong-secret')),
    ).rejects.toThrow()
  })

  it('throws (never falls back to service role) when the JWT secret is missing', async () => {
    delete process.env.SUPABASE_JWT_SECRET
    await expect(mintUserJwt('user-1')).rejects.toThrow(/SUPABASE_JWT_SECRET/)
  })

  it('throws when the JWT secret is the placeholder value', async () => {
    process.env.SUPABASE_JWT_SECRET = 'placeholder'
    await expect(mintUserJwt('user-1')).rejects.toThrow(/SUPABASE_JWT_SECRET/)
  })
})
