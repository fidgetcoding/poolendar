import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUndo } from '@/lib/hooks/use-undo'

function makeOp(overrides: Partial<Parameters<ReturnType<typeof useUndo>['pushOperation']>[0]> = {}) {
  return {
    type: 'delete' as const,
    entityType: 'task' as const,
    entityId: 'task-1',
    previousState: { id: 'task-1' },
    newState: null,
    execute: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn(),
    ...overrides,
  }
}

describe('useUndo — destructive grace window', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('defers execute during the grace window', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const op = makeOp()

    act(() => result.current.pushOperation(op))

    // Not executed yet, but pending + undoable.
    expect(op.execute).not.toHaveBeenCalled()
    expect(result.current.pendingOperations).toHaveLength(1)
    expect(result.current.canUndo).toBe(true)
  })

  it('cancelPending rolls back and never executes', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const op = makeOp()

    act(() => result.current.pushOperation(op))
    const id = result.current.pendingOperations[0]!.id
    act(() => result.current.cancelPending(id))

    expect(op.rollback).toHaveBeenCalledTimes(1)
    expect(op.execute).not.toHaveBeenCalled()
    expect(result.current.pendingOperations).toHaveLength(0)
  })

  it('commits execute once the grace window elapses', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const op = makeOp()

    act(() => result.current.pushOperation(op))
    act(() => vi.advanceTimersByTime(30_000))

    expect(op.execute).toHaveBeenCalledTimes(1)
    expect(op.rollback).not.toHaveBeenCalled()
    expect(result.current.pendingOperations).toHaveLength(0)
  })

  it('flushPending commits every pending op immediately', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const a = makeOp({ entityId: 'a' })
    const b = makeOp({ entityId: 'b' })

    act(() => {
      result.current.pushOperation(a)
      result.current.pushOperation(b)
    })
    act(() => result.current.flushPending())

    expect(a.execute).toHaveBeenCalledTimes(1)
    expect(b.execute).toHaveBeenCalledTimes(1)
    expect(result.current.pendingOperations).toHaveLength(0)
  })
})

describe('useUndo — non-destructive ops', () => {
  it('executes create/update immediately (no grace)', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const op = makeOp({ type: 'update' })

    act(() => result.current.pushOperation(op))

    expect(op.execute).toHaveBeenCalledTimes(1)
    expect(result.current.pendingOperations).toHaveLength(0)
    expect(result.current.canUndo).toBe(true)
  })

  it('undo pops the stack and rolls back; redo re-executes', () => {
    const { result } = renderHook(() => useUndo(30_000))
    const op = makeOp({ type: 'update' })

    act(() => result.current.pushOperation(op))
    act(() => result.current.undo())
    expect(op.rollback).toHaveBeenCalledTimes(1)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(op.execute).toHaveBeenCalledTimes(2)
  })
})
