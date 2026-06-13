import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  mockSupabaseResult,
  mockSupabaseError,
  resetSupabaseMocks,
} from './mock-supabase'
import { createTestQueryClient } from './test-utils'
import {
  useFrames,
  useCreateFrame,
  useUpdateFrame,
  useDeleteFrame,
  useToggleFrame,
  useReorderFrames,
  frameKeys,
} from '../use-frames'
import type { Frame } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = '2026-06-13T12:00:00.000Z'

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'frame-1',
    user_id: 'test-user-id',
    name: 'Deep Work',
    description: 'Focused coding time',
    color: '#4f46e5',
    time_blocks: [
      { day: 1, start: '09:00', end: '12:00' },
      { day: 2, start: '09:00', end: '12:00' },
    ],
    recurrence_rule: null,
    is_active: true,
    day_overrides: {},
    priority_rank: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFrames', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    vi.mocked(fetch).mockReset()
  })

  it('fetches active frames ordered by priority_rank', async () => {
    const frames = [
      makeFrame({ id: 'frame-1', priority_rank: 0 }),
      makeFrame({ id: 'frame-2', name: 'Admin', priority_rank: 1 }),
    ]
    mockSupabaseResult(frames)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useFrames(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].name).toBe('Deep Work')
    expect(result.current.data![1].name).toBe('Admin')

    queryClient.clear()
  })

  it('returns empty array when no frames exist', async () => {
    mockSupabaseResult([])

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useFrames(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])

    queryClient.clear()
  })

  it('propagates supabase errors', async () => {
    mockSupabaseError({ message: 'DB down' })

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useFrames(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ message: 'DB down' })

    queryClient.clear()
  })
})

describe('useCreateFrame', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('creates a frame and returns it', async () => {
    const created = makeFrame({ id: 'new-frame', name: 'Exercise' })
    mockSupabaseResult(created)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useCreateFrame(), { wrapper })

    await act(async () => {
      const { id, user_id, created_at, updated_at, ...input } = created
      result.current.mutate(input as any)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Exercise')

    queryClient.clear()
  })

  it('invalidates frame list queries on settle', async () => {
    const created = makeFrame({ id: 'new-frame' })
    mockSupabaseResult(created)

    const { queryClient, wrapper } = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateFrame(), { wrapper })

    await act(async () => {
      const { id, user_id, created_at, updated_at, ...input } = created
      result.current.mutate(input as any)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: frameKeys.lists() }),
    )

    invalidateSpy.mockRestore()
    queryClient.clear()
  })
})

describe('useUpdateFrame', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('updates frame fields', async () => {
    const updated = makeFrame({ name: 'Deep Focus' })
    mockSupabaseResult(updated)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useUpdateFrame(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'frame-1', data: { name: 'Deep Focus' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Deep Focus')

    queryClient.clear()
  })

  it('optimistically updates the cache', async () => {
    const updated = makeFrame({ name: 'Deep Focus' })
    mockSupabaseResult(updated)

    const { queryClient, wrapper } = createTestQueryClient()

    // Pre-seed
    queryClient.setQueryData(frameKeys.lists(), [makeFrame()])

    const { result } = renderHook(() => useUpdateFrame(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'frame-1', data: { name: 'Deep Focus' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })
})

describe('useDeleteFrame', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('deletes a frame', async () => {
    mockSupabaseResult(null)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useDeleteFrame(), { wrapper })

    await act(async () => {
      result.current.mutate('frame-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('optimistically removes the frame from cache', async () => {
    mockSupabaseResult(null)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(frameKeys.lists(), [
      makeFrame({ id: 'frame-1' }),
      makeFrame({ id: 'frame-2' }),
    ])

    const { result } = renderHook(() => useDeleteFrame(), { wrapper })

    await act(async () => {
      result.current.mutate('frame-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })
})

describe('useToggleFrame', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    vi.mocked(fetch).mockReset()
  })

  it('calls POST /api/frames/:id/toggle', async () => {
    const toggled = makeFrame({ is_active: false })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(toggled),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useToggleFrame(), { wrapper })

    await act(async () => {
      result.current.mutate('frame-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetch).toHaveBeenCalledWith('/api/frames/frame-1/toggle', {
      method: 'POST',
    })
    expect(result.current.data?.is_active).toBe(false)

    queryClient.clear()
  })

  it('optimistically toggles is_active in cache', async () => {
    const toggled = makeFrame({ is_active: false })
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(toggled),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(frameKeys.lists(), [makeFrame({ is_active: true })])

    const { result } = renderHook(() => useToggleFrame(), { wrapper })

    await act(async () => {
      result.current.mutate('frame-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('rolls back cache on fetch error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(frameKeys.lists(), [makeFrame({ is_active: true })])

    const { result } = renderHook(() => useToggleFrame(), { wrapper })

    await act(async () => {
      result.current.mutate('frame-1')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache should be restored to original (is_active: true)
    const cached = queryClient.getQueryData<Frame[]>(frameKeys.lists())
    expect(cached?.[0]?.is_active).toBe(true)

    queryClient.clear()
  })
})

describe('useReorderFrames', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    vi.mocked(fetch).mockReset()
  })

  it('calls POST /api/frames/reorder with ordered ids', async () => {
    const reordered = [
      makeFrame({ id: 'frame-2', priority_rank: 0 }),
      makeFrame({ id: 'frame-1', priority_rank: 1 }),
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(reordered),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useReorderFrames(), { wrapper })

    await act(async () => {
      result.current.mutate(['frame-2', 'frame-1'])
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetch).toHaveBeenCalledWith('/api/frames/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: ['frame-2', 'frame-1'] }),
    })

    queryClient.clear()
  })

  it('optimistically reorders frames in cache', async () => {
    const reordered = [
      makeFrame({ id: 'frame-2', priority_rank: 0 }),
      makeFrame({ id: 'frame-1', priority_rank: 1 }),
    ]
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(reordered),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(frameKeys.lists(), [
      makeFrame({ id: 'frame-1', priority_rank: 0 }),
      makeFrame({ id: 'frame-2', priority_rank: 1 }),
    ])

    const { result } = renderHook(() => useReorderFrames(), { wrapper })

    await act(async () => {
      result.current.mutate(['frame-2', 'frame-1'])
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('rolls back on error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Reorder failed' }),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const original = [
      makeFrame({ id: 'frame-1', priority_rank: 0 }),
      makeFrame({ id: 'frame-2', priority_rank: 1 }),
    ]
    queryClient.setQueryData(frameKeys.lists(), original)

    const { result } = renderHook(() => useReorderFrames(), { wrapper })

    await act(async () => {
      result.current.mutate(['frame-2', 'frame-1'])
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const cached = queryClient.getQueryData<Frame[]>(frameKeys.lists())
    expect(cached?.[0]?.id).toBe('frame-1')
    expect(cached?.[1]?.id).toBe('frame-2')

    queryClient.clear()
  })
})

describe('frameKeys', () => {
  it('builds correct key hierarchy', () => {
    expect(frameKeys.all).toEqual(['frames'])
    expect(frameKeys.lists()).toEqual(['frames', 'list'])
  })
})
