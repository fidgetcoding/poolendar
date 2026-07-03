import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ──────────────────────────────────────────────────────────────

const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      upsert: mockUpsert,
      select: mockSelect,
      single: mockSingle,
      delete: mockDelete,
      eq: mockEq,
    }),
  })),
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Google OAuth', () => {
  let getGoogleOAuthUrl: typeof import('../oauth').getGoogleOAuthUrl
  let exchangeCodeForTokens: typeof import('../oauth').exchangeCodeForTokens
  let disconnectGoogleAccount: typeof import('../oauth').disconnectGoogleAccount

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()
    ;(globalThis.fetch as any).mockReset()

    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.GOOGLE_TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString('base64')

    const mod = await import('../oauth')
    getGoogleOAuthUrl = mod.getGoogleOAuthUrl
    exchangeCodeForTokens = mod.exchangeCodeForTokens
    disconnectGoogleAccount = mod.disconnectGoogleAccount
  })

  // ── getGoogleOAuthUrl ───────────────────────────────────────────────────

  describe('getGoogleOAuthUrl()', () => {
    it('generates a URL with all required OAuth parameters', () => {
      const url = getGoogleOAuthUrl('signed-state-123', 'https://app.poolendar.com/callback')
      const parsed = new URL(url)

      expect(parsed.origin).toBe('https://accounts.google.com')
      expect(parsed.pathname).toBe('/o/oauth2/v2/auth')
      expect(parsed.searchParams.get('client_id')).toBe('test-client-id')
      expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.poolendar.com/callback')
      expect(parsed.searchParams.get('response_type')).toBe('code')
      expect(parsed.searchParams.get('access_type')).toBe('offline')
      expect(parsed.searchParams.get('prompt')).toBe('consent')
      expect(parsed.searchParams.get('state')).toBe('signed-state-123')
    })

    it('includes calendar and userinfo scopes', () => {
      const url = getGoogleOAuthUrl('state', 'https://example.com/cb')
      const parsed = new URL(url)
      const scope = parsed.searchParams.get('scope') ?? ''

      expect(scope).toContain('calendar.events')
      expect(scope).toContain('calendar.readonly')
      expect(scope).toContain('calendar.settings.readonly')
      expect(scope).toContain('userinfo.email')
    })
  })

  // ── exchangeCodeForTokens ─────────────────────────────────────────────

  describe('exchangeCodeForTokens()', () => {
    it('exchanges auth code for tokens and fetches user email', async () => {
      ;(globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at_123',
            refresh_token: 'rt_456',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ email: 'nate@poolendar.com' }),
        })

      const result = await exchangeCodeForTokens(
        'auth-code-xyz',
        'https://app.poolendar.com/callback'
      )

      expect(result).toEqual({
        access_token: 'at_123',
        refresh_token: 'rt_456',
        expires_in: 3600,
        email: 'nate@poolendar.com',
      })

      // Verify the token exchange request
      const tokenCall = (globalThis.fetch as any).mock.calls[0]
      expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token')
      const body = new URLSearchParams(tokenCall[1].body)
      expect(body.get('code')).toBe('auth-code-xyz')
      expect(body.get('grant_type')).toBe('authorization_code')
      expect(body.get('client_id')).toBe('test-client-id')
      expect(body.get('client_secret')).toBe('test-client-secret')
    })

    it('throws when token exchange HTTP response is not ok', async () => {
      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      })

      await expect(
        exchangeCodeForTokens('bad-code', 'https://example.com/cb')
      ).rejects.toThrow('Google token exchange failed: 400')
    })

    it('throws when no refresh_token is returned', async () => {
      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at_123',
          // no refresh_token
          expires_in: 3600,
        }),
      })

      await expect(
        exchangeCodeForTokens('code', 'https://example.com/cb')
      ).rejects.toThrow('No refresh_token returned')
    })

    it('throws when userinfo fetch fails', async () => {
      ;(globalThis.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at_123',
            refresh_token: 'rt_456',
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })

      await expect(
        exchangeCodeForTokens('code', 'https://example.com/cb')
      ).rejects.toThrow('Failed to fetch Google user info')
    })
  })

  // ── disconnectGoogleAccount ───────────────────────────────────────────

  describe('disconnectGoogleAccount()', () => {
    it('revokes token and deletes the account row', async () => {
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                access_token: 'at_123',
                refresh_token: 'rt_456',
              },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: mockDeleteEq }),
      }

      // Re-import with fresh mock
      vi.resetModules()
      const { createServerClient } = await import('@supabase/ssr')
      ;(createServerClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue(mockSelectChain),
      })
      ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: true })

      const mod = await import('../oauth')
      await mod.disconnectGoogleAccount('acct-1')

      // Verify revocation was attempted with the refresh_token
      const revokeCall = (globalThis.fetch as any).mock.calls[0]
      expect(revokeCall[0]).toContain('oauth2.googleapis.com/revoke')
      expect(revokeCall[0]).toContain('rt_456')
    })

    it('does not throw when token revocation fails', async () => {
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                access_token: 'at_123',
                refresh_token: 'rt_456',
              },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: mockDeleteEq }),
      }

      vi.resetModules()
      const { createServerClient } = await import('@supabase/ssr')
      ;(createServerClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue(mockSelectChain),
      })

      // Revocation throws
      ;(globalThis.fetch as any).mockRejectedValueOnce(new Error('network fail'))

      const mod = await import('../oauth')
      // Should NOT throw — revocation failure is non-fatal
      await expect(mod.disconnectGoogleAccount('acct-1')).resolves.toBeUndefined()
    })

    it('throws when the database delete fails', async () => {
      const mockDeleteEq = vi.fn().mockResolvedValue({
        error: { message: 'FK constraint' },
      })
      const mockSelectChain = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { access_token: 'at', refresh_token: 'rt' },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: mockDeleteEq }),
      }

      vi.resetModules()
      const { createServerClient } = await import('@supabase/ssr')
      ;(createServerClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue(mockSelectChain),
      })
      ;(globalThis.fetch as any).mockResolvedValueOnce({ ok: true })

      const mod = await import('../oauth')
      await expect(mod.disconnectGoogleAccount('acct-1')).rejects.toThrow(
        'Failed to disconnect Google account'
      )
    })
  })
})
