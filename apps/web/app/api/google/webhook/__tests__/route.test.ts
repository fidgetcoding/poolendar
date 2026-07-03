import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/google/sync', () => ({
  pullChanges: vi.fn().mockResolvedValue({ created: 0, updated: 0, deleted: 0 }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimitAsync: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/env', () => ({
  requireEnv: vi.fn(() => 'x'),
}))

const mockMaybeSingle = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
      }),
    }),
  })),
}))

import { POST } from '../route'
import { pullChanges } from '@/lib/google/sync'
import { rateLimitAsync } from '@/lib/rate-limit'

const SECRET = 'webhook-shared-secret'

function webhookRequest(headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL('/api/google/webhook', 'http://localhost:3000'), {
    method: 'POST',
    headers,
  })
}

describe('POST /api/google/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GOOGLE_WEBHOOK_SECRET = SECRET
    mockMaybeSingle.mockResolvedValue({ data: { id: 'acct-1' }, error: null })
    vi.mocked(rateLimitAsync).mockResolvedValue(true)
  })

  it('acknowledges the initial sync handshake with 200', async () => {
    const res = await POST(webhookRequest({ 'x-goog-resource-state': 'sync' }))
    expect(res.status).toBe(200)
    expect(pullChanges).not.toHaveBeenCalled()
  })

  it('returns 400 when channel/resource headers are missing', async () => {
    const res = await POST(
      webhookRequest({ 'x-goog-channel-token': SECRET, 'x-goog-resource-state': 'exists' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 403 when the channel token does not match the secret', async () => {
    const res = await POST(
      webhookRequest({
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': 'WRONG',
      })
    )
    expect(res.status).toBe(403)
    expect(pullChanges).not.toHaveBeenCalled()
  })

  it('returns 403 when no webhook secret is configured (cannot validate)', async () => {
    delete process.env.GOOGLE_WEBHOOK_SECRET
    const res = await POST(
      webhookRequest({
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': SECRET,
      })
    )
    expect(res.status).toBe(403)
  })

  it('returns 429 when the channel is rate limited', async () => {
    vi.mocked(rateLimitAsync).mockResolvedValue(false)
    const res = await POST(
      webhookRequest({
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': SECRET,
      })
    )
    expect(res.status).toBe(429)
  })

  it('pulls changes for the account owning the channel on a valid notification', async () => {
    const res = await POST(
      webhookRequest({
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': SECRET,
      })
    )
    expect(res.status).toBe(200)
    expect(pullChanges).toHaveBeenCalledWith('acct-1')
  })

  it('acknowledges (200) without syncing when no account owns the channel', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await POST(
      webhookRequest({
        'x-goog-channel-id': 'unknown-chan',
        'x-goog-resource-id': 'res-1',
        'x-goog-resource-state': 'exists',
        'x-goog-channel-token': SECRET,
      })
    )
    expect(res.status).toBe(200)
    expect(pullChanges).not.toHaveBeenCalled()
  })
})
