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
  chain.select = vi.fn().mockImplementation((_sel?: string, opts?: { count?: string; head?: boolean }) => {
    if (opts?.count) {
      return {
        ...chain,
        then: (resolve: (v: MockResult) => void) => resolve({ ...result, count: result.count ?? 0 }),
      }
    }
    return chain
  })
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

const mockRunPipeline = vi.fn()
vi.mock('@/lib/auto-schedule/pipeline', () => ({
  runSchedulingPipeline: (...args: any[]) => mockRunPipeline(...args),
  PipelineError: class PipelineError extends Error {
    constructor(msg: string) { super(msg); this.name = 'PipelineError' }
  },
}))

const mockClassifyByKeywords = vi.fn()
const mockSeedKeywords = vi.fn()
vi.mock('@/lib/auto-schedule/classifier', () => ({
  classifyByKeywords: (...args: any[]) => mockClassifyByKeywords(...args),
  seedKeywords: (...args: any[]) => mockSeedKeywords(...args),
}))

const mockClassifyByLLM = vi.fn()
vi.mock('@/lib/auto-schedule/classifier-llm', () => ({
  classifyByLLM: (...args: any[]) => mockClassifyByLLM(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/auto-schedule') {
  const init: RequestInit = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1])
}

const PLACEMENT = {
  task_id: 'task-1',
  frame_id: 'frame-1',
  frame_name: 'Deep Work',
  scheduled_start: '2026-06-16T09:00:00Z',
  scheduled_end: '2026-06-16T10:00:00Z',
  score: 0.85,
}

// ---------------------------------------------------------------------------
// Tests: Preview (auto-schedule/preview/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/auto-schedule/preview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticate.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const { POST } = await import('../preview/route')
    const res = await POST(makeRequest('POST', {}))

    expect(res.status).toBe(401)
  })

  it('returns scored placements without applying', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })
    mockRunPipeline.mockResolvedValue({ placements: [PLACEMENT], scored: [], settings: {} })

    const { POST } = await import('../preview/route')
    const res = await POST(makeRequest('POST', { window_days: 7 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.placements).toHaveLength(1)
    expect(json.placements[0].task_id).toBe('task-1')
    // Preview should NOT have applied=true
    expect(json.applied).toBeUndefined()
  })

  it('returns message when nothing to schedule', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })
    mockRunPipeline.mockResolvedValue({
      placements: [],
      scored: [],
      settings: {},
      message: 'No unscheduled tasks found',
    })

    const { POST } = await import('../preview/route')
    const res = await POST(makeRequest('POST', {}))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe('No unscheduled tasks found')
  })

  it('returns 500 on PipelineError', async () => {
    const { PipelineError } = await import('@/lib/auto-schedule/pipeline')
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })
    mockRunPipeline.mockRejectedValue(new PipelineError('Failed to load profile'))

    const { POST } = await import('../preview/route')
    const res = await POST(makeRequest('POST', {}))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('Failed to load profile')
  })
})

// ---------------------------------------------------------------------------
// Tests: Run (auto-schedule/run/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/auto-schedule/run', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns placements with applied=false when confirm is false', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })
    mockRunPipeline.mockResolvedValue({ placements: [PLACEMENT], scored: [], settings: {} })

    const { POST } = await import('../run/route')
    const res = await POST(makeRequest('POST', { confirm: false }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.placements).toHaveLength(1)
    expect(json.applied).toBe(false)
  })

  it('applies placements and returns applied=true when confirm is true', async () => {
    const factory = createSupabaseMock()
    // Task updates (1 placement = 1 update)
    factory.setResult('tasks', { data: null, error: null })
    // Profile update for last_run_at
    factory.setResult('profiles', { data: null, error: null })
    const supabase = factory.build()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase })
    mockRunPipeline.mockResolvedValue({
      placements: [PLACEMENT],
      scored: [],
      settings: { auto_schedule_ai_enabled: true },
    })

    const { POST } = await import('../run/route')
    const res = await POST(makeRequest('POST', { confirm: true, window_days: 7 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.applied).toBe(true)
    expect(json.applied_count).toBe(1)
  })

  it('returns 400 for invalid JSON body', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../run/route')
    const req = new NextRequest('http://localhost/api/auto-schedule/run', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('clamps window_days to max 30', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })
    mockRunPipeline.mockResolvedValue({ placements: [], scored: [], settings: {} })

    const { POST } = await import('../run/route')
    // window_days > 30 should be rejected by validator (max: 30)
    const res = await POST(makeRequest('POST', { confirm: false, window_days: 31 }))

    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// Tests: Status (auto-schedule/status/route.ts)
// ---------------------------------------------------------------------------

describe('GET /api/auto-schedule/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns enabled state, last run, and counts', async () => {
    const factory = createSupabaseMock()
    // Profile
    factory.setResult('profiles', {
      data: {
        settings: {
          auto_schedule_ai_enabled: true,
          auto_schedule_last_run_at: '2026-06-12T10:00:00Z',
        },
      },
      error: null,
    })
    // Scheduled count
    factory.setResult('tasks', { data: null, error: null, count: 5 })
    // Unscheduled count
    factory.setResult('tasks', { data: null, error: null, count: 3 })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../status/route')
    const res = await GET(makeRequest('GET', undefined, 'http://localhost/api/auto-schedule/status'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.enabled).toBe(true)
    expect(json.last_run_at).toBe('2026-06-12T10:00:00Z')
    expect(json.scheduled_count).toBe(5)
    expect(json.unscheduled_count).toBe(3)
  })

  it('returns defaults when profile has no settings', async () => {
    const factory = createSupabaseMock()
    factory.setResult('profiles', { data: { settings: null }, error: null })
    factory.setResult('tasks', { data: null, error: null, count: 0 })
    factory.setResult('tasks', { data: null, error: null, count: 0 })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { GET } = await import('../status/route')
    const res = await GET(makeRequest('GET', undefined, 'http://localhost/api/auto-schedule/status'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.enabled).toBe(false)
    expect(json.last_run_at).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests: Unschedule (auto-schedule/unschedule/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/auto-schedule/unschedule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes all auto-scheduled placements', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', {
      data: [{ id: 'task-1' }, { id: 'task-2' }],
      error: null,
    })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../unschedule/route')
    const res = await POST(makeRequest('POST', undefined, 'http://localhost/api/auto-schedule/unschedule'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.unscheduled_count).toBe(2)
  })

  it('returns 0 when no auto-scheduled tasks exist', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: [], error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../unschedule/route')
    const res = await POST(makeRequest('POST', undefined, 'http://localhost/api/auto-schedule/unschedule'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.unscheduled_count).toBe(0)
  })

  it('returns 500 when DB update fails', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: null, error: { message: 'DB error' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../unschedule/route')
    const res = await POST(makeRequest('POST', undefined, 'http://localhost/api/auto-schedule/unschedule'))

    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Tests: Classify (auto-schedule/classify/route.ts)
// ---------------------------------------------------------------------------

describe('POST /api/auto-schedule/classify', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns keyword-layer classification when keyword match found', async () => {
    const factory = createSupabaseMock()
    // Task lookup
    factory.setResult('tasks', { data: { id: 'task-1', title: 'Debug parser', notes: null }, error: null })
    // Frames
    factory.setResult('frames', {
      data: [{ id: 'frame-1', name: 'Deep Work', description: 'Coding', is_active: true }],
      error: null,
    })
    // Keywords
    factory.setResult('frame_keywords', {
      data: [{ frame_id: 'frame-1', keyword: 'debug', weight: 1.0 }],
      error: null,
    })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    mockClassifyByKeywords.mockReturnValue({
      frame_id: 'frame-1',
      frame_name: 'Deep Work',
      confidence: 0.9,
      layer: 'keyword',
    })

    const { POST } = await import('../classify/route')
    const res = await POST(
      makeRequest('POST', { task_id: '00000000-0000-0000-0000-000000000001' }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.frame_id).toBe('frame-1')
    expect(json.layer).toBe('keyword')
  })

  it('falls back to LLM classification when keywords do not match', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: { id: 'task-1', title: 'Ambiguous thing', notes: null }, error: null })
    factory.setResult('frames', {
      data: [{ id: 'frame-1', name: 'Deep Work', description: 'Coding', is_active: true }],
      error: null,
    })
    factory.setResult('frame_keywords', { data: [], error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    mockClassifyByKeywords.mockReturnValue(null)
    mockSeedKeywords.mockReturnValue([])
    mockClassifyByLLM.mockResolvedValue({
      frame_id: 'frame-1',
      frame_name: 'Deep Work',
      confidence: 0.7,
    })

    const { POST } = await import('../classify/route')
    const res = await POST(
      makeRequest('POST', { task_id: '00000000-0000-0000-0000-000000000001' }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.frame_id).toBe('frame-1')
    expect(json.layer).toBe('llm')
  })

  it('returns null classification when neither keyword nor LLM matches', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: { id: 'task-1', title: 'Walk the dog', notes: null }, error: null })
    factory.setResult('frames', {
      data: [{ id: 'frame-1', name: 'Deep Work', description: 'Coding', is_active: true }],
      error: null,
    })
    factory.setResult('frame_keywords', { data: [], error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    mockClassifyByKeywords.mockReturnValue(null)
    mockSeedKeywords.mockReturnValue([])
    mockClassifyByLLM.mockResolvedValue(null)

    const { POST } = await import('../classify/route')
    const res = await POST(
      makeRequest('POST', { task_id: '00000000-0000-0000-0000-000000000001' }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.frame_id).toBeNull()
    expect(json.confidence).toBe(0)
    expect(json.layer).toBe('none')
  })

  it('returns 404 when task does not exist', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: null, error: { code: 'PGRST116' } })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../classify/route')
    const res = await POST(
      makeRequest('POST', { task_id: '00000000-0000-0000-0000-000000000001' }),
    )

    expect(res.status).toBe(404)
  })

  it('returns 400 when no active frames configured', async () => {
    const factory = createSupabaseMock()
    factory.setResult('tasks', { data: { id: 'task-1', title: 'Test', notes: null }, error: null })
    factory.setResult('frames', { data: [], error: null })
    factory.setResult('frame_keywords', { data: [], error: null })
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../classify/route')
    const res = await POST(
      makeRequest('POST', { task_id: '00000000-0000-0000-0000-000000000001' }),
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('No active frames')
  })

  it('returns 400 for missing task_id', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../classify/route')
    const res = await POST(makeRequest('POST', {}))

    expect(res.status).toBe(400)
  })

  it('returns 400 for non-UUID task_id', async () => {
    const factory = createSupabaseMock()
    mockAuthenticate.mockResolvedValue({ userId: 'user-123', supabase: factory.build() })

    const { POST } = await import('../classify/route')
    const res = await POST(makeRequest('POST', { task_id: 'not-a-uuid' }))

    expect(res.status).toBe(400)
  })
})
