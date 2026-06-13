import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// We need to isolate the module-level Map between test runs.
// Re-import a fresh copy for each describe block via dynamic import.
// ---------------------------------------------------------------------------

let rateLimit: typeof import('../rate-limit').rateLimit
let getRateLimitHeaders: typeof import('../rate-limit').getRateLimitHeaders

beforeEach(async () => {
  vi.useFakeTimers()
  // Reset module to get a fresh rateLimitMap
  vi.resetModules()
  const mod = await import('../rate-limit')
  rateLimit = mod.rateLimit
  getRateLimitHeaders = mod.getRateLimitHeaders
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Core rate limiting
// ---------------------------------------------------------------------------

describe('rateLimit', () => {
  it('allows the first request within window', () => {
    expect(rateLimit('user-1', 5, 60_000)).toBe(true)
  })

  it('allows all requests within the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('user-1', 5, 60_000)).toBe(true)
    }
  })

  it('denies request exceeding the limit', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('user-1', 5, 60_000)
    }
    expect(rateLimit('user-1', 5, 60_000)).toBe(false)
  })

  it('resets counter after window expires', () => {
    // Use up the limit
    for (let i = 0; i < 3; i++) {
      rateLimit('user-1', 3, 10_000)
    }
    expect(rateLimit('user-1', 3, 10_000)).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(10_001)

    // Should be allowed again
    expect(rateLimit('user-1', 3, 10_000)).toBe(true)
  })

  it('tracks different keys independently', () => {
    // Exhaust user-1
    for (let i = 0; i < 2; i++) {
      rateLimit('user-1', 2, 60_000)
    }
    expect(rateLimit('user-1', 2, 60_000)).toBe(false)

    // user-2 should still be allowed
    expect(rateLimit('user-2', 2, 60_000)).toBe(true)
  })

  it('increments count correctly for each request', () => {
    rateLimit('user-1', 10, 60_000)
    rateLimit('user-1', 10, 60_000)
    rateLimit('user-1', 10, 60_000)

    const headers = getRateLimitHeaders('user-1', 10, 60_000)
    expect(headers['X-RateLimit-Remaining']).toBe('7')
  })

  it('handles limit of 1 (single request per window)', () => {
    expect(rateLimit('strict', 1, 5000)).toBe(true)
    expect(rateLimit('strict', 1, 5000)).toBe(false)
    vi.advanceTimersByTime(5001)
    expect(rateLimit('strict', 1, 5000)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Rate limit headers
// ---------------------------------------------------------------------------

describe('getRateLimitHeaders', () => {
  it('returns full limit for unknown key', () => {
    const headers = getRateLimitHeaders('new-key', 10, 60_000)
    expect(headers['X-RateLimit-Limit']).toBe('10')
    expect(headers['X-RateLimit-Remaining']).toBe('10')
    expect(headers['X-RateLimit-Reset']).toBe('60')
  })

  it('returns correct remaining count after requests', () => {
    rateLimit('user-1', 5, 60_000)
    rateLimit('user-1', 5, 60_000)

    const headers = getRateLimitHeaders('user-1', 5, 60_000)
    expect(headers['X-RateLimit-Limit']).toBe('5')
    expect(headers['X-RateLimit-Remaining']).toBe('3')
  })

  it('returns 0 remaining when limit exhausted', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('user-1', 5, 60_000)
    }

    const headers = getRateLimitHeaders('user-1', 5, 60_000)
    expect(headers['X-RateLimit-Remaining']).toBe('0')
  })

  it('returns correct reset time in seconds', () => {
    // Set the clock to a known position
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
    rateLimit('user-1', 5, 30_000)

    // Advance 10 seconds
    vi.advanceTimersByTime(10_000)

    const headers = getRateLimitHeaders('user-1', 5, 30_000)
    const resetSeconds = parseInt(headers['X-RateLimit-Reset'], 10)
    // Window was 30s, 10s elapsed => ~20s remaining
    expect(resetSeconds).toBe(20)
  })

  it('reset time is window duration for unknown key', () => {
    const headers = getRateLimitHeaders('unknown', 10, 120_000)
    expect(headers['X-RateLimit-Reset']).toBe('120')
  })
})
