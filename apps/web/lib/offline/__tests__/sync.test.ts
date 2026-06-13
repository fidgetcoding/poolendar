import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MutationQueueEntry } from '../db'

// ---------------------------------------------------------------------------
// Mock dependencies — vi.mock factories are hoisted so they cannot
// reference variables declared in the test body. Use vi.hoisted() to
// define the mocks before the factory runs.
// ---------------------------------------------------------------------------

const {
  mockAdd,
  mockPut,
  mockUpdate,
  mockDelete,
  mockClear,
  mockSortBy,
  mockNotEqual,
  mockWhere,
  mockFrom,
} = vi.hoisted(() => {
  const mockAdd = vi.fn()
  const mockPut = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()
  const mockClear = vi.fn()
  const mockSortBy = vi.fn()
  const mockNotEqual = vi.fn(() => ({ sortBy: mockSortBy }))
  const mockWhere = vi.fn(() => ({ notEqual: mockNotEqual }))
  const mockFrom = vi.fn()

  return {
    mockAdd,
    mockPut,
    mockUpdate,
    mockDelete,
    mockClear,
    mockSortBy,
    mockNotEqual,
    mockWhere,
    mockFrom,
  }
})

vi.mock('../db', () => {
  const tableFns = () => ({
    put: mockPut,
    update: mockUpdate,
    delete: mockDelete,
    clear: mockClear,
  })
  return {
    db: {
      events: tableFns(),
      tasks: tableFns(),
      subtasks: tableFns(),
      routines: tableFns(),
      routineInstances: tableFns(),
      mutationQueue: {
        add: mockAdd,
        where: mockWhere,
        delete: mockDelete,
        update: mockUpdate,
      },
    },
  }
})

vi.mock('../../supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

import { queueMutation, drainQueue, resolveConflict } from '../sync'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// queueMutation
// ---------------------------------------------------------------------------

describe('sync - queueMutation', () => {
  it('adds entry to mutation queue with retries=0', async () => {
    mockAdd.mockResolvedValue(1)
    mockPut.mockResolvedValue(undefined)

    await queueMutation({
      method: 'POST',
      table: 'events',
      entityId: 'evt-1',
      data: { id: 'evt-1', title: 'Test' },
      timestamp: 1000,
    })

    expect(mockAdd).toHaveBeenCalledWith({
      method: 'POST',
      table: 'events',
      entityId: 'evt-1',
      data: { id: 'evt-1', title: 'Test' },
      timestamp: 1000,
      retries: 0,
    })
  })

  it('performs optimistic local PUT for POST method', async () => {
    mockAdd.mockResolvedValue(1)
    mockPut.mockResolvedValue(undefined)

    await queueMutation({
      method: 'POST',
      table: 'events',
      entityId: 'evt-1',
      data: { id: 'evt-1', title: 'Test' },
      timestamp: 1000,
    })

    expect(mockPut).toHaveBeenCalledWith({ id: 'evt-1', title: 'Test' })
  })

  it('performs optimistic local PUT for PUT method', async () => {
    mockAdd.mockResolvedValue(1)
    mockPut.mockResolvedValue(undefined)

    await queueMutation({
      method: 'PUT',
      table: 'events',
      entityId: 'evt-1',
      data: { id: 'evt-1', title: 'Updated' },
      timestamp: 1000,
    })

    expect(mockPut).toHaveBeenCalledWith({ id: 'evt-1', title: 'Updated' })
  })

  it('performs optimistic local update for PATCH method', async () => {
    mockAdd.mockResolvedValue(1)
    mockUpdate.mockResolvedValue(undefined)

    await queueMutation({
      method: 'PATCH',
      table: 'tasks',
      entityId: 'task-1',
      data: { title: 'Patched' },
      timestamp: 1000,
    })

    expect(mockUpdate).toHaveBeenCalledWith('task-1', { title: 'Patched' })
  })

  it('performs optimistic local delete for DELETE method', async () => {
    mockAdd.mockResolvedValue(1)
    mockDelete.mockResolvedValue(undefined)

    await queueMutation({
      method: 'DELETE',
      table: 'tasks',
      entityId: 'task-1',
      data: null,
      timestamp: 1000,
    })

    expect(mockDelete).toHaveBeenCalledWith('task-1')
  })

  it('skips local update for unknown table', async () => {
    mockAdd.mockResolvedValue(1)

    await queueMutation({
      method: 'POST',
      table: 'unknown_table',
      entityId: 'x-1',
      data: { id: 'x-1' },
      timestamp: 1000,
    })

    // Only the queue add should fire, no local table write
    expect(mockAdd).toHaveBeenCalledTimes(1)
    expect(mockPut).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// drainQueue
// ---------------------------------------------------------------------------

describe('sync - drainQueue', () => {
  function setupDrainMocks(
    entries: MutationQueueEntry[],
    supabaseResults: Array<{ error: unknown }>
  ) {
    mockSortBy.mockResolvedValue(entries)
    let callIndex = 0
    mockFrom.mockImplementation(() => {
      const result = supabaseResults[callIndex] ?? { error: null }
      callIndex++
      return {
        insert: vi.fn().mockResolvedValue(result),
        upsert: vi.fn().mockResolvedValue(result),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(result),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(result),
        }),
      }
    })
  }

  it('drains entries in timestamp order on success', async () => {
    const entries: MutationQueueEntry[] = [
      { id: 1, method: 'POST', table: 'events', entityId: 'e1', data: { id: 'e1' }, timestamp: 100, retries: 0 },
      { id: 2, method: 'POST', table: 'events', entityId: 'e2', data: { id: 'e2' }, timestamp: 200, retries: 0 },
    ]
    setupDrainMocks(entries, [{ error: null }, { error: null }])

    const result = await drainQueue()
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
  })

  it('increments retry count on failure', async () => {
    const entries: MutationQueueEntry[] = [
      { id: 1, method: 'POST', table: 'events', entityId: 'e1', data: { id: 'e1' }, timestamp: 100, retries: 0 },
    ]
    setupDrainMocks(entries, [{ error: { message: 'network error' } }])

    const result = await drainQueue()
    expect(result.failed).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith(1, { retries: 1 })
  })

  it('dead-letters entry after 3 retries (retries set to -1)', async () => {
    const entries: MutationQueueEntry[] = [
      { id: 5, method: 'PATCH', table: 'tasks', entityId: 't1', data: { title: 'x' }, timestamp: 100, retries: 2 },
    ]
    setupDrainMocks(entries, [{ error: { message: 'server error' } }])

    const result = await drainQueue()
    expect(result.failed).toBe(1)
    expect(mockUpdate).toHaveBeenCalledWith(5, { retries: -1 })
  })

  it('skips dead-lettered entries (retries=-1 excluded by notEqual)', async () => {
    // The where clause filters retries != -1, so dead-lettered entries
    // never appear in the pending list. We verify the query shape.
    mockSortBy.mockResolvedValue([])
    await drainQueue()
    expect(mockWhere).toHaveBeenCalledWith('retries')
    expect(mockNotEqual).toHaveBeenCalledWith(-1)
  })

  it('returns zero counts when queue is empty', async () => {
    mockSortBy.mockResolvedValue([])
    const result = await drainQueue()
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// resolveConflict
// ---------------------------------------------------------------------------

describe('sync - resolveConflict', () => {
  it('returns server entity when local data is null', () => {
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: null,
      timestamp: 100,
      retries: 0,
    }
    const server = { id: 'e1', title: 'Server Title', updated_at: '2026-06-15T10:00:00Z' }
    const result = resolveConflict(entry, server)
    expect(result).toEqual(server)
  })

  it('server wins when server updated_at is newer', () => {
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: { title: 'Local Title', updated_at: '2026-06-15T08:00:00Z' },
      timestamp: 100,
      retries: 0,
    }
    const server = { id: 'e1', title: 'Server Title', updated_at: '2026-06-15T10:00:00Z' }
    const result = resolveConflict(entry, server)
    expect(result.title).toBe('Server Title')
  })

  it('local wins when local updated_at is newer', () => {
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: { title: 'Local Title', updated_at: '2026-06-15T12:00:00Z' },
      timestamp: 100,
      retries: 0,
    }
    const server = { id: 'e1', title: 'Server Title', updated_at: '2026-06-15T10:00:00Z' }
    const result = resolveConflict(entry, server)
    expect(result.title).toBe('Local Title')
  })

  it('local overlays server when timestamps are equal', () => {
    const ts = '2026-06-15T10:00:00Z'
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: { title: 'Local Title', updated_at: ts },
      timestamp: 100,
      retries: 0,
    }
    const server = { id: 'e1', title: 'Server Title', updated_at: ts }
    const result = resolveConflict(entry, server)
    expect(result.title).toBe('Local Title')
  })

  it('local wins when no timestamps exist', () => {
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: { title: 'Local Title' },
      timestamp: 100,
      retries: 0,
    }
    const server = { id: 'e1', title: 'Server Title' }
    const result = resolveConflict(entry, server)
    expect(result.title).toBe('Local Title')
  })

  it('preserves server-only fields when local wins', () => {
    const entry: MutationQueueEntry = {
      id: 1,
      method: 'PATCH',
      table: 'events',
      entityId: 'e1',
      data: { title: 'Local Title', updated_at: '2026-06-15T12:00:00Z' },
      timestamp: 100,
      retries: 0,
    }
    const server = {
      id: 'e1',
      title: 'Server Title',
      notes: 'Server notes',
      updated_at: '2026-06-15T10:00:00Z',
    }
    const result = resolveConflict(entry, server)
    expect(result.title).toBe('Local Title')
    expect(result.notes).toBe('Server notes')
    expect(result.id).toBe('e1')
  })
})
