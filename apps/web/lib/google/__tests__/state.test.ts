import { describe, it, expect, beforeEach } from 'vitest'
import { signOAuthState, verifyOAuthState } from '../state'

describe('OAuth state signing', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_SECRET = 'test-signing-secret'
  })

  it('round-trips a signed state back to its userId and nonce', () => {
    const userId = '00000000-0000-4000-8000-000000000001'
    const { state, nonce } = signOAuthState(userId)

    const verified = verifyOAuthState(state)
    expect(verified).not.toBeNull()
    expect(verified!.userId).toBe(userId)
    expect(verified!.nonce).toBe(nonce)
  })

  it('rejects a tampered signature', () => {
    const { state } = signOAuthState('user-1')
    const [uid, nonce] = state.split('.')
    // 32-byte-looking but wrong signature
    const forged = `${uid}.${nonce}.${'0'.repeat(64)}`
    expect(verifyOAuthState(forged)).toBeNull()
  })

  it('rejects a swapped userId (signature no longer matches the payload)', () => {
    const { state } = signOAuthState('victim-user')
    const [, nonce, sig] = state.split('.')
    const tampered = `attacker-user.${nonce}.${sig}`
    expect(verifyOAuthState(tampered)).toBeNull()
  })

  it('rejects malformed state strings', () => {
    expect(verifyOAuthState('not-valid')).toBeNull()
    expect(verifyOAuthState('two.parts')).toBeNull()
    expect(verifyOAuthState('a.b.c.d')).toBeNull()
  })

  it('rejects state signed under a different secret', () => {
    const { state } = signOAuthState('user-1')
    process.env.GOOGLE_CLIENT_SECRET = 'a-completely-different-secret'
    expect(verifyOAuthState(state)).toBeNull()
  })

  it('returns null (never throws) when no signing secret is configured', () => {
    const { state } = signOAuthState('user-1')
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(verifyOAuthState(state)).toBeNull()
  })

  it('signOAuthState refuses to sign without a secret', () => {
    delete process.env.GOOGLE_CLIENT_SECRET
    expect(() => signOAuthState('user-1')).toThrow('GOOGLE_CLIENT_SECRET')
  })
})
