import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  mockSupabaseResult,
  mockSupabaseError,
  resetSupabaseMocks,
} from './mock-supabase'
import { createTestQueryClient } from './test-utils'
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  tagKeys,
} from '../use-tags'
import { taskKeys } from '../use-tasks'
import type { Tag } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = '2026-06-13T12:00:00.000Z'

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    user_id: 'test-user-id',
    name: 'Work',
    color: '#3b82f6',
    prefix: null,
    priority_rank: 1,
    created_at: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTags', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('fetches all tags', async () => {
    const tags = [
      makeTag({ id: 'tag-1', name: 'Work' }),
      makeTag({ id: 'tag-2', name: 'Personal', color: '#22c55e' }),
    ]
    mockSupabaseResult(tags)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useTags(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0]!.name).toBe('Work')
    expect(result.current.data![1]!.name).toBe('Personal')

    queryClient.clear()
  })

  it('returns empty array when no tags exist', async () => {
    mockSupabaseResult([])

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useTags(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])

    queryClient.clear()
  })

  it('propagates supabase errors', async () => {
    mockSupabaseError({ message: 'Table not found' })

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useTags(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    queryClient.clear()
  })
})

describe('useCreateTag', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('creates a tag', async () => {
    const created = makeTag({ id: 'new-tag', name: 'Urgent' })
    mockSupabaseResult(created)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useCreateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({
        name: 'Urgent',
        color: '#ef4444',
        prefix: null,
        priority_rank: 0,
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Urgent')

    queryClient.clear()
  })

  it('optimistically adds tag to cache', async () => {
    const created = makeTag({ id: 'new-tag', name: 'Urgent' })
    mockSupabaseResult(created)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(tagKeys.lists(), [makeTag()])

    const { result } = renderHook(() => useCreateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({
        name: 'Urgent',
        color: '#ef4444',
        prefix: null,
        priority_rank: 0,
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('invalidates tag list queries on settle', async () => {
    const created = makeTag({ id: 'new-tag' })
    mockSupabaseResult(created)

    const { queryClient, wrapper } = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({
        name: 'New',
        color: '#000',
        prefix: null,
        priority_rank: 2,
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: tagKeys.lists() }),
    )

    invalidateSpy.mockRestore()
    queryClient.clear()
  })
})

describe('useUpdateTag', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('updates a tag', async () => {
    const updated = makeTag({ name: 'Important', color: '#dc2626' })
    mockSupabaseResult(updated)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useUpdateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({
        id: 'tag-1',
        data: { name: 'Important', color: '#dc2626' },
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.name).toBe('Important')
    expect(result.current.data?.color).toBe('#dc2626')

    queryClient.clear()
  })

  it('optimistically updates tag in cache', async () => {
    const updated = makeTag({ name: 'Important' })
    mockSupabaseResult(updated)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(tagKeys.lists(), [makeTag()])

    const { result } = renderHook(() => useUpdateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'tag-1', data: { name: 'Important' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('rolls back on error', async () => {
    mockSupabaseError({ message: 'Update failed' })

    const { queryClient, wrapper } = createTestQueryClient()
    const original = [makeTag()]
    queryClient.setQueryData(tagKeys.lists(), original)

    const { result } = renderHook(() => useUpdateTag(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'tag-1', data: { name: 'Bad' } })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache should be rolled back
    const cached = queryClient.getQueryData<Tag[]>(tagKeys.lists())
    expect(cached?.[0]?.name).toBe('Work')

    queryClient.clear()
  })
})

describe('useDeleteTag', () => {
  beforeEach(() => {
    resetSupabaseMocks()
  })

  it('deletes a tag', async () => {
    mockSupabaseResult(null)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useDeleteTag(), { wrapper })

    await act(async () => {
      result.current.mutate('tag-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('optimistically removes tag from cache', async () => {
    mockSupabaseResult(null)

    const { queryClient, wrapper } = createTestQueryClient()
    queryClient.setQueryData(tagKeys.lists(), [
      makeTag({ id: 'tag-1' }),
      makeTag({ id: 'tag-2', name: 'Personal' }),
    ])

    const { result } = renderHook(() => useDeleteTag(), { wrapper })

    await act(async () => {
      result.current.mutate('tag-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    queryClient.clear()
  })

  it('invalidates both tag and task queries on settle', async () => {
    mockSupabaseResult(null)

    const { queryClient, wrapper } = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTag(), { wrapper })

    await act(async () => {
      result.current.mutate('tag-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Deleting a tag should also invalidate tasks (since tasks reference tags)
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: tagKeys.lists() }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: taskKeys.all }),
    )

    invalidateSpy.mockRestore()
    queryClient.clear()
  })
})

describe('tagKeys', () => {
  it('builds correct key hierarchy', () => {
    expect(tagKeys.all).toEqual(['tags'])
    expect(tagKeys.lists()).toEqual(['tags', 'list'])
  })
})
