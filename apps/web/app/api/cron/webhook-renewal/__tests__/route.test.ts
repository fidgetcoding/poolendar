import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/google/webhooks', () => ({
  registerAccountWebhook: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/env', () => ({ requireEnv: vi.fn(() => 'x') }))

const mockSelect = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ select: mockSelect }),
  })),
}))

import { GET } from '../route'
import { registerAccountWebhook } from '@/lib/google/webhooks'

const CRON_SECRET = 'cron-secret-value'

function cronRequest(auth?: string): NextRequest {
  return new NextRequest(
    new URL('/api/cron/webhook-renewal', 'http://localhost:3000'),
    { method: 'GET', ...(auth ? { headers: { authorization: auth } } : {}) }
  )
}

describe('GET /api/cron/webhook-renewal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = CRON_SECRET
    mockSelect.mockResolvedValue({ data: [], error: null })
  })

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(cronRequest())
    expect(res.status).toBe(401)
    expect(registerAccountWebhook).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong bearer token', async () => {
    const res = await GET(cronRequest('Bearer nope'))
    expect(res.status).toBe(401)
    expect(registerAccountWebhook).not.toHaveBeenCalled()
  })

  it('renews channels that are missing or near expiry with the correct secret', async () => {
    // One account with no channel yet + one already renewed far in the future.
    mockSelect.mockResolvedValue({
      data: [
        { id: 'acct-new', email: 'a@x.com', webhook_channel_id: null, webhook_channel_expiration: null },
        {
          id: 'acct-fresh',
          email: 'b@x.com',
          webhook_channel_id: 'chan-b',
          webhook_channel_expiration: new Date(Date.now() + 6 * 24 * 60 * 60_000).toISOString(),
        },
      ],
      error: null,
    })

    const res = await GET(cronRequest(`Bearer ${CRON_SECRET}`))
    expect(res.status).toBe(200)
    // Only the account without a live channel is renewed.
    expect(registerAccountWebhook).toHaveBeenCalledTimes(1)
    expect(registerAccountWebhook).toHaveBeenCalledWith('acct-new')
  })
})
