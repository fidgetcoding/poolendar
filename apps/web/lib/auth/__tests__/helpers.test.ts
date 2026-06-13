import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
const mockSupabaseClient = {
  auth: { getUser: mockGetUser },
  from: vi.fn(),
}

vi.mock('../api-key', () => ({
  authenticateApiKey: vi.fn(),
}))

vi.mock('../../supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('auth helpers', () => {
  let authenticate: typeof import('../helpers').authenticate
  let isAuthError: typeof import('../helpers').isAuthError
  let validationError: typeof import('../helpers').validationError
  let authenticateApiKey: any

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

    const helpers = await import('../helpers')
    authenticate = helpers.authenticate
    isAuthError = helpers.isAuthError
    validationError = helpers.validationError

    const apiKeyMod = await import('../api-key')
    authenticateApiKey = apiKeyMod.authenticateApiKey
  })

  // ── authenticate() ────────────────────────────────────────────────────────

  describe('authenticate()', () => {
    it('returns userId + supabase client for valid API key', async () => {
      ;(authenticateApiKey as any).mockResolvedValue('user-from-apikey')

      const request = new NextRequest('https://app.poolendar.com/api/events')
      const result = await authenticate(request)

      expect(result).not.toBeInstanceOf(NextResponse)
      const authResult = result as { userId: string; supabase: any }
      expect(authResult.userId).toBe('user-from-apikey')
      expect(authResult.supabase).toBeDefined()
    })

    it('returns userId + supabase client for valid session', async () => {
      ;(authenticateApiKey as any).mockResolvedValue(null)
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'session-user-id' } },
        error: null,
      })

      const request = new NextRequest('https://app.poolendar.com/api/events')
      const result = await authenticate(request)

      expect(result).not.toBeInstanceOf(NextResponse)
      const authResult = result as { userId: string; supabase: any }
      expect(authResult.userId).toBe('session-user-id')
    })

    it('returns 401 NextResponse when neither API key nor session is valid', async () => {
      ;(authenticateApiKey as any).mockResolvedValue(null)
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const request = new NextRequest('https://app.poolendar.com/api/events')
      const result = await authenticate(request)

      expect(result).toBeInstanceOf(NextResponse)
      const res = result as NextResponse
      expect(res.status).toBe(401)

      const body = await res.json()
      expect(body).toEqual({ error: 'Unauthorized' })
    })

    it('tries API key auth before session auth', async () => {
      ;(authenticateApiKey as any).mockResolvedValue('api-key-user')

      const request = new NextRequest('https://app.poolendar.com/api/events')
      await authenticate(request)

      // getUser should NOT be called because API key auth succeeded first
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })

  // ── isAuthError() ─────────────────────────────────────────────────────────

  describe('isAuthError()', () => {
    it('returns true for NextResponse', () => {
      const response = NextResponse.json({ error: 'nope' }, { status: 401 })
      expect(isAuthError(response)).toBe(true)
    })

    it('returns false for AuthResult object', () => {
      const authResult = { userId: 'abc', supabase: {} as any }
      expect(isAuthError(authResult)).toBe(false)
    })
  })

  // ── validationError() ─────────────────────────────────────────────────────

  describe('validationError()', () => {
    it('formats Zod issues into a structured 400 response', async () => {
      const issues = [
        { path: ['title'], message: 'Required' },
        { path: ['start_time'], message: 'Invalid date' },
        { path: ['start_time'], message: 'Must be in the future' },
      ]

      const response = validationError(issues)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toBe('Validation error')
      expect(body.details).toEqual({
        title: ['Required'],
        start_time: ['Invalid date', 'Must be in the future'],
      })
    })

    it('uses _root key for issues with empty path', async () => {
      const issues = [{ path: [], message: 'Invalid input' }]
      const response = validationError(issues)
      const body = await response.json()

      expect(body.details).toEqual({ _root: ['Invalid input'] })
    })

    it('joins nested paths with dots', async () => {
      const issues = [
        { path: ['attendees', 0, 'email'], message: 'Invalid email' },
      ]
      const response = validationError(issues)
      const body = await response.json()

      expect(body.details).toEqual({ 'attendees.0.email': ['Invalid email'] })
    })
  })
})
