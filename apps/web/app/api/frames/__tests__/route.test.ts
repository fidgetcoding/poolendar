import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Chainable Supabase mock
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown; count?: number }

function createChain(result: MockResult = { data: null, error: null }) {
  const chain: Record<string, any> = {}
  const methods = [
    'from', 'select', 'insert', 'update', 'delete',
    'eq', 'in', 'lt', 'gt', 'not', 'is', 'or', 'ilike',
    'order', 'limit', 'single', 'maybeSingle',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: MockResult) => void) => resolve(result)
  ;(chain as any)[Symbol.toStringTag] = 'Promise'
  chain.single = vi.fn().mockReturnValue({
    ...chain,
    then: (resolve: (v: MockResult) => void) => resolve(result),
  })
  chain.select = vi.fn().mockImplementation(() => chain)
  return chain
}

function createSupabaseMock() {
  let defaultResult: MockResult = { data: null, error: null }
  const tableResults = new Map<string, MockResult[]>()

  function setResult(table: string, result: MockResult) {
    const existing = tableResults.get(table) ?? []
    existing.push(result)
    tableResults.set(table, existing)
  }

  function build() {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        const results = tableResults.get(table) ?? []
        const result = results.shift() ?? defaultResult
        return createChain(result)
      }),
    }
  }

  return { setResult, setDefault: (r: MockResult) => { defaultResult = r }, build }
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockAuthenticate = vi.fn()

vi.mock('@/lib/auth/helpers', () => ({
  authenticate: (...args: any[]) => mockAuthenticate(...args),
  isAuthError: (result: any) =>
    result instanceof Response ||
    (result && typeof result.status === 'number' && typeof result.json === 'function'),
  validationError: (issues: any[]) => {
    const details: Record<string, string[]> = {}
    for (const issue of issues) {
      const key = issue.path.join('.') || '_root'
      if (!details[key]) details[key] = []
      details[key].push(issue.message)
    }
    return Response.json({ error: 'Validation error', details }, { status: 400 })
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/frames') {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init)
}

const VALID_FRAME = {
  name: 'Deep Work',
  description: 'Focused coding blocks',
  color: '#6366f1',
  time_blocks: [{ day: 1, start: '09:00', end: '12:00' }],
  is_active: true,
  priority_rank: 0,
}

const FRAME_ROW = {
  id: 'frame-1',
  user_id: 'user-123',
  ...VALID_FRAME,
  recurrence_rule: null,
  day_overrides: {},
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests: GET list / POST create (frames/route.ts)
// ---------------------------------------------------------------------------

describe('GET /api/frames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const { GET } = await import('../route')
    const res = await GET(makeRequest('GET'))

    expect(res.status).toBe(401)
  })

  it('returns frames ordered by priority_rank', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: [FRAME_ROW], error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../route')
    const res = await GET(makeRequest('GET'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('Deep Work')
  })

  it('returns 500 when DB query fails', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { message: 'DB error' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../route')
    const res = await GET(makeRequest('GET'))

    expect(res.status).toBe(500)
  })
})

describe('POST /api/frames', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a frame with valid data', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: FRAME_ROW, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const res = await POST(makeRequest('POST', VALID_FRAME))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.name).toBe('Deep Work')
  })

  it('returns 400 for invalid JSON body', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const req = new NextRequest('http://localhost/api/frames', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('returns 400 when time_blocks is empty', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const body = { ...VALID_FRAME, time_blocks: [] }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(400)
  })

  it('returns 400 when time_blocks have invalid day (>6)', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const body = { ...VALID_FRAME, time_blocks: [{ day: 7, start: '09:00', end: '12:00' }] }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(400)
  })

  it('returns 400 when time_blocks have invalid time format', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const body = { ...VALID_FRAME, time_blocks: [{ day: 1, start: '9am', end: '12:00' }] }
    const res = await POST(makeRequest('POST', body))

    expect(res.status).toBe(400)
  })

  it('returns 409 for duplicate frame name', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: '23505', message: 'duplicate' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../route')
    const res = await POST(makeRequest('POST', VALID_FRAME))
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error).toContain('name already exists')
  })
})

// ---------------------------------------------------------------------------
// Tests: GET single / PATCH / DELETE (frames/[id]/route.ts)
// ---------------------------------------------------------------------------

describe('GET /api/frames/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns frame by ID', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: FRAME_ROW, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../[id]/route')
    const res = await GET(
      makeRequest('GET', undefined, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('frame-1')
  })

  it('returns 404 when frame does not exist', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: 'PGRST116' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../[id]/route')
    const res = await GET(
      makeRequest('GET', undefined, 'http://localhost/api/frames/fake'),
      { params: Promise.resolve({ id: 'fake' }) },
    )

    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/frames/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates frame with partial data', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: { ...FRAME_ROW, name: 'Shallow Work' }, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(
      makeRequest('PATCH', { name: 'Shallow Work' }, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.name).toBe('Shallow Work')
  })

  it('returns 400 when no fields provided', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(
      makeRequest('PATCH', {}, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when frame not found (PGRST116)', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: 'PGRST116' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(
      makeRequest('PATCH', { name: 'Nope' }, 'http://localhost/api/frames/fake'),
      { params: Promise.resolve({ id: 'fake' }) },
    )

    expect(res.status).toBe(404)
  })

  it('returns 409 for duplicate name on update', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: '23505' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { PATCH } = await import('../[id]/route')
    const res = await PATCH(
      makeRequest('PATCH', { name: 'Taken Name' }, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )

    expect(res.status).toBe(409)
  })
})

describe('DELETE /api/frames/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes frame and returns 204', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { DELETE } = await import('../[id]/route')
    const res = await DELETE(
      makeRequest('DELETE', undefined, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )

    expect(res.status).toBe(204)
  })

  it('returns 500 when delete fails', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { message: 'FK constraint' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { DELETE } = await import('../[id]/route')
    const res = await DELETE(
      makeRequest('DELETE', undefined, 'http://localhost/api/frames/frame-1'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Tests: Toggle endpoint (frames/[id]/toggle/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/frames/:id/toggle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flips is_active from true to false', async () => {
    const factory = createSupabaseMock()
    // Read current state
    factory.setResult('frames', { data: { is_active: true }, error: null })
    // Update result
    factory.setResult('frames', { data: { ...FRAME_ROW, is_active: false }, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/toggle/route')
    const res = await POST(
      makeRequest('POST', undefined, 'http://localhost/api/frames/frame-1/toggle'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.is_active).toBe(false)
  })

  it('flips is_active from false to true', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: { is_active: false }, error: null })
    factory.setResult('frames', { data: { ...FRAME_ROW, is_active: true }, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/toggle/route')
    const res = await POST(
      makeRequest('POST', undefined, 'http://localhost/api/frames/frame-1/toggle'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.is_active).toBe(true)
  })

  it('returns 404 when frame does not exist', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: 'PGRST116' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/toggle/route')
    const res = await POST(
      makeRequest('POST', undefined, 'http://localhost/api/frames/fake/toggle'),
      { params: Promise.resolve({ id: 'fake' }) },
    )

    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// Tests: Override endpoint (frames/[id]/override/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/frames/:id/override', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds a day override when active=false', async () => {
    const factory = createSupabaseMock()
    // Read current overrides
    factory.setResult('frames', { data: { day_overrides: {} }, error: null })
    // Update result
    factory.setResult('frames', {
      data: { ...FRAME_ROW, day_overrides: { '2026-06-20': false } },
      error: null,
    })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/override/route')
    const res = await POST(
      makeRequest('POST', { date: '2026-06-20', active: false }, 'http://localhost/api/frames/frame-1/override'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.day_overrides['2026-06-20']).toBe(false)
  })

  it('removes override when active=true (restores default)', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: { day_overrides: { '2026-06-20': false } }, error: null })
    factory.setResult('frames', { data: { ...FRAME_ROW, day_overrides: {} }, error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/override/route')
    const res = await POST(
      makeRequest('POST', { date: '2026-06-20', active: true }, 'http://localhost/api/frames/frame-1/override'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.day_overrides).not.toHaveProperty('2026-06-20')
  })

  it('returns 404 when frame does not exist', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', { data: null, error: { code: 'PGRST116' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/override/route')
    const res = await POST(
      makeRequest('POST', { date: '2026-06-20', active: false }, 'http://localhost/api/frames/fake/override'),
      { params: Promise.resolve({ id: 'fake' }) },
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid date format in override', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../[id]/override/route')
    const res = await POST(
      makeRequest('POST', { date: 'June 20', active: false }, 'http://localhost/api/frames/frame-1/override'),
      { params: Promise.resolve({ id: 'frame-1' }) },
    )

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Tests: Reorder endpoint (frames/reorder/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/frames/reorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates priority_rank for all frames in order', async () => {
    const factory = createSupabaseMock()
    // Fetch existing frames
    factory.setResult('frames', {
      data: [{ id: 'frame-1' }, { id: 'frame-2' }, { id: 'frame-3' }],
      error: null,
    })
    // Update calls (3) + final fetch
    for (let i = 0; i < 3; i++) {
      factory.setResult('frames', { data: null, error: null })
    }
    factory.setResult('frames', {
      data: [
        { ...FRAME_ROW, id: 'frame-3', priority_rank: 0 },
        { ...FRAME_ROW, id: 'frame-1', priority_rank: 1 },
        { ...FRAME_ROW, id: 'frame-2', priority_rank: 2 },
      ],
      error: null,
    })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../reorder/route')
    const res = await POST(
      makeRequest('POST', { order: ['frame-3', 'frame-1', 'frame-2'] }, 'http://localhost/api/frames/reorder'),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(3)
  })

  it('returns 400 when order is not an array', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../reorder/route')
    const res = await POST(
      makeRequest('POST', { order: 'not-array' }, 'http://localhost/api/frames/reorder'),
    )

    expect(res.status).toBe(400)
  })

  it('returns 400 when order is an empty array', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../reorder/route')
    const res = await POST(
      makeRequest('POST', { order: [] }, 'http://localhost/api/frames/reorder'),
    )

    expect(res.status).toBe(400)
  })

  it('returns 404 when order contains unknown frame ID', async () => {
    const factory = createSupabaseMock()
    factory.setResult('frames', {
      data: [{ id: 'frame-1' }, { id: 'frame-2' }],
      error: null,
    })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../reorder/route')
    const res = await POST(
      makeRequest('POST', { order: ['frame-1', 'frame-unknown'] }, 'http://localhost/api/frames/reorder'),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toContain('frame-unknown')
  })
})
