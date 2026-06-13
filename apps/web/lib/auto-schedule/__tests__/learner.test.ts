import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordCorrection, getCorrections } from '../learner'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------
type MockFn = ReturnType<typeof vi.fn>

interface MockQueryBuilder {
  insert: MockFn
  select: MockFn
  upsert: MockFn
  update: MockFn
  eq: MockFn
  ilike: MockFn
  single: MockFn
  order: MockFn
  limit: MockFn
}

function createMockSupabase() {
  // Each call to .from() can produce a different chain, so we track per-table
  // mocks. The default chain returns { data: null, error: null, count: 0 }.
  const queryBuilder: MockQueryBuilder = {
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    select: vi.fn(),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }

  // Wire up chaining: every method returns the builder itself unless
  // overridden for a specific test.
  for (const key of Object.keys(queryBuilder) as (keyof MockQueryBuilder)[]) {
    if (!queryBuilder[key].mockReturnValue) continue
    // Default: return builder for chaining
    queryBuilder[key].mockReturnValue(queryBuilder)
  }

  // select() returns builder for chaining
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.ilike.mockReturnValue(queryBuilder)
  queryBuilder.order.mockReturnValue(queryBuilder)
  queryBuilder.limit.mockReturnValue(queryBuilder)

  // By default single() resolves to { data: null, error: null }
  queryBuilder.single.mockResolvedValue({ data: null, error: null })

  const supabase = {
    from: vi.fn().mockReturnValue(queryBuilder),
    _qb: queryBuilder,
  }

  return supabase
}

// ---------------------------------------------------------------------------
// recordCorrection
// ---------------------------------------------------------------------------
describe('recordCorrection', () => {
  let supabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    supabase = createMockSupabase()
  })

  it('inserts a row into frame_corrections', async () => {
    // select() with count returns a resolved value with count
    supabase._qb.ilike.mockResolvedValue({ count: 0, data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug the parser',
      'frame-old',
      'frame-new',
    )

    // First call to from() should be frame_corrections for the insert
    expect(supabase.from).toHaveBeenCalledWith('frame_corrections')
    expect(supabase._qb.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      task_id: 'task-1',
      task_title: 'Debug the parser',
      from_frame_id: 'frame-old',
      to_frame_id: 'frame-new',
    })
  })

  it('extracts keywords from the task title and checks correction counts', async () => {
    // "Debug parser" tokenizes to ["debug", "parser"]
    // Return count < 3 so no keyword update happens
    supabase._qb.ilike.mockResolvedValue({ count: 1, data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug parser',
      'frame-old',
      'frame-new',
    )

    // Should query frame_corrections for each keyword
    // "debug" and "parser" are both > 1 char, so both get checked
    const ilikeCalls = supabase._qb.ilike.mock.calls
    const ilikeArgs = ilikeCalls.map((c: string[]) => c[1])
    expect(ilikeArgs).toContain('%debug%')
    expect(ilikeArgs).toContain('%parser%')
  })

  it('does not update frame_keywords when correction count is below threshold (< 3)', async () => {
    supabase._qb.ilike.mockResolvedValue({ count: 2, data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug parser',
      'frame-old',
      'frame-new',
    )

    expect(supabase._qb.upsert).not.toHaveBeenCalled()
  })

  it('upserts a high-weight keyword when correction count reaches threshold (= 3)', async () => {
    // Return count = 3 to trigger keyword promotion
    supabase._qb.ilike.mockResolvedValue({ count: 3, data: null, error: null })
    // single() for the old-keyword lookup returns no existing row
    supabase._qb.single.mockResolvedValue({ data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug parser',
      'frame-old',
      'frame-new',
    )

    expect(supabase._qb.upsert).toHaveBeenCalled()
    const upsertCall = supabase._qb.upsert.mock.calls[0]
    const upsertData = upsertCall[0]
    expect(upsertData).toMatchObject({
      user_id: 'user-1',
      frame_id: 'frame-new',
      weight: 1.5,
      source: 'correction',
    })
    expect(upsertCall[1]).toEqual({ onConflict: 'user_id,frame_id,keyword' })
  })

  it('downweights the old frame keyword mapping when it exists', async () => {
    // Trigger threshold
    supabase._qb.ilike.mockResolvedValue({ count: 5, data: null, error: null })
    // The old-keyword lookup returns an existing row
    supabase._qb.single.mockResolvedValue({
      data: { id: 'kw-old-1' },
      error: null,
    })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug',
      'frame-old',
      'frame-new',
    )

    // Should call update({ weight: 0.3 }) for the old keyword
    expect(supabase._qb.update).toHaveBeenCalledWith({ weight: 0.3 })
  })

  it('does not attempt to downweight when fromFrameId is null', async () => {
    // count >= 3 triggers promotion, but fromFrameId is null
    supabase._qb.ilike.mockResolvedValue({ count: 3, data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Debug',
      null, // no source frame
      'frame-new',
    )

    // upsert should be called (promotion), but single() should NOT be called
    // for old-keyword lookup because fromFrameId is null
    expect(supabase._qb.upsert).toHaveBeenCalled()
    // single() may have been called for insert chain, but update() should not
    // be called with weight: 0.3
    const updateCalls = supabase._qb.update.mock.calls
    const downweightCall = updateCalls.find(
      (c: Array<{ weight?: number }>) => c[0]?.weight === 0.3,
    )
    expect(downweightCall).toBeUndefined()
  })

  it('escapes SQL wildcards (underscores) in keywords for ilike queries', async () => {
    // "my_var" tokenizes to "my_var" (underscore preserved by \w)
    supabase._qb.ilike.mockResolvedValue({ count: 0, data: null, error: null })

    await recordCorrection(
      supabase as never,
      'user-1',
      'task-1',
      'Fix my_var issue',
      'frame-old',
      'frame-new',
    )

    const ilikeCalls = supabase._qb.ilike.mock.calls
    // The keyword "my_var" should have its underscore escaped as "my\_var"
    const escapedCall = ilikeCalls.find((c: string[]) =>
      c[1]?.includes('my\\_var'),
    )
    expect(escapedCall).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// getCorrections
// ---------------------------------------------------------------------------
describe('getCorrections', () => {
  it('queries frame_corrections ordered by created_at descending', async () => {
    const supabase = createMockSupabase()
    supabase._qb.limit.mockResolvedValue({
      data: [
        { id: 'c1', task_title: 'Fix bug', to_frame_id: 'f1' },
        { id: 'c2', task_title: 'Send email', to_frame_id: 'f2' },
      ],
      error: null,
    })

    const result = await getCorrections(supabase as never, 'user-1', 10)

    expect(supabase.from).toHaveBeenCalledWith('frame_corrections')
    expect(result).toHaveLength(2)
    expect(result[0].task_title).toBe('Fix bug')
  })

  it('throws when the query returns an error', async () => {
    const supabase = createMockSupabase()
    supabase._qb.limit.mockResolvedValue({
      data: null,
      error: { message: 'DB connection failed' },
    })

    await expect(
      getCorrections(supabase as never, 'user-1'),
    ).rejects.toMatchObject({ message: 'DB connection failed' })
  })
})
