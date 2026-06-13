import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { resetSupabaseMocks } from './mock-supabase'
import { createTestQueryClient } from './test-utils'
import {
  useAutoScheduleStatus,
  useAutoScheduleSettings,
  useAutoSchedulePreview,
  useAutoScheduleRun,
  useAutoScheduleUnschedule,
  useClassifyTask,
  autoScheduleKeys,
} from '../use-auto-schedule'
import { taskKeys } from '../use-tasks'
import type { AutoScheduleStatus, AutoSchedulePlacement, TaskClassification } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStatus(overrides: Partial<AutoScheduleStatus> = {}): AutoScheduleStatus {
  return {
    enabled: true,
    last_run_at: '2026-06-13T10:00:00Z',
    scheduled_count: 5,
    unscheduled_count: 3,
    ...overrides,
  }
}

function makePlacement(overrides: Partial<AutoSchedulePlacement> = {}): AutoSchedulePlacement {
  return {
    task_id: 'task-1',
    task_title: 'Write tests',
    frame_id: 'frame-1',
    frame_name: 'Deep Work',
    scheduled_start: '2026-06-14T09:00:00Z',
    scheduled_end: '2026-06-14T10:00:00Z',
    score: 0.85,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutoScheduleStatus', () => {
  beforeEach(() => {
    resetSupabaseMocks()
    vi.mocked(fetch).mockReset()
  })

  it('fetches auto-schedule status', async () => {
    const status = makeStatus()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(status),
      text: () => Promise.resolve(JSON.stringify(status)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoScheduleStatus(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.enabled).toBe(true)
    expect(result.current.data?.scheduled_count).toBe(5)
    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/status')

    queryClient.clear()
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Internal Server Error'),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoScheduleStatus(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Internal Server Error')

    queryClient.clear()
  })
})

describe('useAutoScheduleSettings', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('fetches auto-schedule settings', async () => {
    const settings = {
      enabled: true,
      ai_classification: false,
      scoring_weights: { urgency: 1, deadline: 1, tag_priority: 0.5, staleness: 0.3 },
      paused_until: null,
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(settings),
      text: () => Promise.resolve(JSON.stringify(settings)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.enabled).toBe(true)
    expect(result.current.data?.scoring_weights.urgency).toBe(1)
    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/settings')

    queryClient.clear()
  })
})

describe('useAutoSchedulePreview', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('returns placements from dry-run', async () => {
    const response = { placements: [makePlacement()] }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoSchedulePreview(), { wrapper })

    await act(async () => {
      result.current.mutate(7)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.placements).toHaveLength(1)
    expect(result.current.data?.placements[0].task_title).toBe('Write tests')

    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ window_days: 7 }),
    })

    queryClient.clear()
  })

  it('sends undefined window_days when no arg is provided', async () => {
    const response = { placements: [] }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoSchedulePreview(), { wrapper })

    await act(async () => {
      result.current.mutate(undefined)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ window_days: undefined }),
    })

    queryClient.clear()
  })

  it('throws on failed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('Bad Request'),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoSchedulePreview(), { wrapper })

    await act(async () => {
      result.current.mutate(7)
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Bad Request')

    queryClient.clear()
  })
})

describe('useAutoScheduleRun', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('applies placements and returns them', async () => {
    const response = { placements: [makePlacement()] }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAutoScheduleRun(), { wrapper })

    await act(async () => {
      result.current.mutate({ confirm: true })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.placements).toHaveLength(1)

    // Should invalidate tasks and auto-schedule status
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: taskKeys.all }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: autoScheduleKeys.status() }),
    )

    invalidateSpy.mockRestore()
    queryClient.clear()
  })

  it('defaults to { confirm: true } when no opts provided', async () => {
    const response = { placements: [] }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useAutoScheduleRun(), { wrapper })

    await act(async () => {
      result.current.mutate(undefined)
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })

    queryClient.clear()
  })
})

describe('useAutoScheduleUnschedule', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('removes auto-placed tasks and returns count', async () => {
    const response = { unscheduled_count: 3 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAutoScheduleUnschedule(), { wrapper })

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.unscheduled_count).toBe(3)

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: taskKeys.all }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: autoScheduleKeys.status() }),
    )

    invalidateSpy.mockRestore()
    queryClient.clear()
  })
})

describe('useClassifyTask', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('classifies a task into a frame', async () => {
    const classification: TaskClassification = {
      frame_id: 'frame-1',
      frame_name: 'Deep Work',
      confidence: 0.92,
      layer: 'keyword',
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(classification),
      text: () => Promise.resolve(JSON.stringify(classification)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useClassifyTask(), { wrapper })

    await act(async () => {
      result.current.mutate('task-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.frame_id).toBe('frame-1')
    expect(result.current.data?.confidence).toBe(0.92)
    expect(result.current.data?.layer).toBe('keyword')

    expect(fetch).toHaveBeenCalledWith('/api/auto-schedule/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: 'task-1' }),
    })

    queryClient.clear()
  })

  it('returns null frame when no match found', async () => {
    const classification: TaskClassification = {
      frame_id: null,
      frame_name: null,
      confidence: 0.1,
      layer: 'none',
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(classification),
      text: () => Promise.resolve(JSON.stringify(classification)),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useClassifyTask(), { wrapper })

    await act(async () => {
      result.current.mutate('task-orphan')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.frame_id).toBeNull()
    expect(result.current.data?.layer).toBe('none')

    queryClient.clear()
  })
})

describe('autoScheduleKeys', () => {
  it('builds correct key hierarchy', () => {
    expect(autoScheduleKeys.all).toEqual(['auto-schedule'])
    expect(autoScheduleKeys.status()).toEqual(['auto-schedule', 'status'])
    expect(autoScheduleKeys.settings()).toEqual(['auto-schedule', 'settings'])
  })
})
