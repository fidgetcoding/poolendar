import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { resetSupabaseMocks } from './mock-supabase'
import { UndoContext, type UndoApi } from '@/lib/undo/undo-context'
import { useUndoable } from '../use-undoable'
import type { Task, CalendarEvent, Routine } from '@poolendar/types'

// mock-supabase installs vi.mock('@/lib/supabase/client') on import (hoisted).

const now = '2026-06-13T12:00:00.000Z'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    user_id: 'u1',
    calendar_id: null,
    parent_id: null,
    title: 'Write tests',
    notes: null,
    importance: 'normal',
    time_estimate_minutes: null,
    earliest_start: null,
    due_date: null,
    due_date_recurrence: null,
    scheduled_start: null,
    scheduled_end: null,
    location: null,
    visibility: 'busy',
    privacy: 'private',
    flexibility: 'flexible',
    status: 'backlog',
    board: 'current',
    is_split: false,
    completed_at: null,
    position: 1,
    reminders: [],
    created_at: now,
    updated_at: now,
    subtasks: [],
    tags: [],
    children: [],
    ...overrides,
  }
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    user_id: 'u1',
    calendar_id: 'cal-1',
    google_event_id: null,
    title: 'Standup',
    notes: null,
    start_time: now,
    end_time: now,
    timezone: 'America/New_York',
    is_all_day: false,
    location: null,
    color_override: null,
    visibility: 'busy',
    privacy: 'public',
    conferencing_url: null,
    recurrence_rule: null,
    recurrence_id: null,
    attendees: [],
    reminders: [],
    status: 'confirmed',
    sync_status: 'synced',
    etag: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: 'r-1',
    user_id: 'u1',
    calendar_id: null,
    title: 'Meditate',
    notes: null,
    start_time: '09:00',
    end_time: '09:15',
    timezone: 'America/New_York',
    recurrence_rule: 'FREQ=DAILY',
    location: null,
    visibility: 'busy',
    privacy: 'private',
    reminders: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function setup() {
  const pushOperation = vi.fn()
  const engine = {
    pushOperation,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    pendingOperations: [],
    cancelPending: vi.fn(),
    flushPending: vi.fn(),
  } as unknown as UndoApi

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(UndoContext.Provider, { value: engine }, children)
    )
  }

  const { result } = renderHook(() => useUndoable(), { wrapper })
  return { result, pushOperation }
}

describe('useUndoable — records undo operations', () => {
  beforeEach(() => resetSupabaseMocks())

  it('deleteTask records a destructive op with the task as previousState', () => {
    const { result, pushOperation } = setup()
    const task = makeTask()

    act(() => result.current.deleteTask(task))

    expect(pushOperation).toHaveBeenCalledTimes(1)
    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('delete')
    expect(op.entityType).toBe('task')
    expect(op.entityId).toBe('task-1')
    expect(op.previousState).toEqual(task)
    expect(typeof op.execute).toBe('function')
    expect(typeof op.rollback).toBe('function')
  })

  it('updateTask records an update op carrying the prior task + the patch', () => {
    const { result, pushOperation } = setup()
    const prev = makeTask({ title: 'Old title' })

    act(() => result.current.updateTask('task-1', { title: 'New title' }, prev))

    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('update')
    expect(op.entityType).toBe('task')
    expect(op.previousState).toEqual(prev)
    expect(op.newState).toMatchObject({ title: 'New title' })
  })

  it('completeTask is destructive (grace) and carries the task', () => {
    const { result, pushOperation } = setup()
    const task = makeTask()

    act(() => result.current.completeTask(task))

    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('complete')
    expect(op.previousState).toEqual(task)
  })

  it('moveTask is a destructive move carrying prior state + destination', () => {
    const { result, pushOperation } = setup()
    const prev = makeTask({ status: 'backlog' })

    act(() =>
      result.current.moveTask({ id: 'task-1', status: 'done', position: 2 }, prev)
    )

    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('move')
    expect(op.previousState).toEqual(prev)
    expect(op.newState).toMatchObject({ status: 'done' })
  })

  it('createEvent records a create op with null previousState', () => {
    const { result, pushOperation } = setup()

    act(() => result.current.createEvent(makeEvent()))

    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('create')
    expect(op.entityType).toBe('event')
    expect(op.previousState).toBeNull()
  })

  it('deleteRoutine records a destructive op with the routine', () => {
    const { result, pushOperation } = setup()
    const routine = makeRoutine()

    act(() => result.current.deleteRoutine(routine))

    const op = pushOperation.mock.calls[0]![0]
    expect(op.type).toBe('delete')
    expect(op.entityType).toBe('routine')
    expect(op.previousState).toEqual(routine)
  })
})
