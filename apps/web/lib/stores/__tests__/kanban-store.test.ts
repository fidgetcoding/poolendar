import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Stub localStorage for persist middleware (Node has no localStorage).
// vi.hoisted runs before module evaluation so persist can find the stub.
// ---------------------------------------------------------------------------
const { storage } = vi.hoisted(() => {
  const storage = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
    removeItem: (key: string) => { storage.delete(key) },
    clear: () => { storage.clear() },
    get length() { return storage.size },
    key: () => null,
  } as Storage
  return { storage }
})

import { useKanbanStore } from '../kanban-store'

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  storage.clear()
  useKanbanStore.setState(useKanbanStore.getInitialState(), true)
})

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('KanbanStore - Initial state', () => {
  it('defaults to current board', () => {
    expect(useKanbanStore.getState().activeBoard).toBe('current')
  })

  it('starts with no collapsed columns', () => {
    expect(useKanbanStore.getState().collapsedColumns).toEqual({})
  })

  it('starts with no tag filter', () => {
    expect(useKanbanStore.getState().activeTagFilter).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Board switching
// ---------------------------------------------------------------------------

describe('KanbanStore - setActiveBoard', () => {
  it('switches to future board', () => {
    useKanbanStore.getState().setActiveBoard('future')
    expect(useKanbanStore.getState().activeBoard).toBe('future')
  })

  it('switches back to current board', () => {
    useKanbanStore.getState().setActiveBoard('future')
    useKanbanStore.getState().setActiveBoard('current')
    expect(useKanbanStore.getState().activeBoard).toBe('current')
  })
})

// ---------------------------------------------------------------------------
// Tag filter
// ---------------------------------------------------------------------------

describe('KanbanStore - setActiveTagFilter', () => {
  it('sets a tag filter', () => {
    useKanbanStore.getState().setActiveTagFilter('tag-work')
    expect(useKanbanStore.getState().activeTagFilter).toBe('tag-work')
  })

  it('clears the tag filter with null', () => {
    useKanbanStore.getState().setActiveTagFilter('tag-work')
    useKanbanStore.getState().setActiveTagFilter(null)
    expect(useKanbanStore.getState().activeTagFilter).toBeNull()
  })

  it('replaces the active filter', () => {
    useKanbanStore.getState().setActiveTagFilter('tag-a')
    useKanbanStore.getState().setActiveTagFilter('tag-b')
    expect(useKanbanStore.getState().activeTagFilter).toBe('tag-b')
  })
})

// ---------------------------------------------------------------------------
// Column collapse
// ---------------------------------------------------------------------------

describe('KanbanStore - column collapse', () => {
  it('toggleColumn collapses a column', () => {
    useKanbanStore.getState().toggleColumn('backlog')
    expect(useKanbanStore.getState().collapsedColumns['backlog']).toBe(true)
  })

  it('toggleColumn expands a collapsed column', () => {
    useKanbanStore.getState().toggleColumn('backlog')
    useKanbanStore.getState().toggleColumn('backlog')
    expect(useKanbanStore.getState().collapsedColumns['backlog']).toBe(false)
  })

  it('setColumnCollapsed sets collapsed explicitly', () => {
    useKanbanStore.getState().setColumnCollapsed('done', true)
    expect(useKanbanStore.getState().collapsedColumns['done']).toBe(true)
  })

  it('setColumnCollapsed sets expanded explicitly', () => {
    useKanbanStore.getState().setColumnCollapsed('done', true)
    useKanbanStore.getState().setColumnCollapsed('done', false)
    expect(useKanbanStore.getState().collapsedColumns['done']).toBe(false)
  })

  it('multiple columns tracked independently', () => {
    useKanbanStore.getState().toggleColumn('backlog')
    useKanbanStore.getState().toggleColumn('in_progress')
    const cols = useKanbanStore.getState().collapsedColumns
    expect(cols['backlog']).toBe(true)
    expect(cols['in_progress']).toBe(true)
    expect(cols['done']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// State persistence across actions
// ---------------------------------------------------------------------------

describe('KanbanStore - state persistence across actions', () => {
  it('tag filter persists after board switch', () => {
    useKanbanStore.getState().setActiveTagFilter('tag-work')
    useKanbanStore.getState().setActiveBoard('future')
    expect(useKanbanStore.getState().activeTagFilter).toBe('tag-work')
  })

  it('collapsed columns persist after board switch', () => {
    useKanbanStore.getState().toggleColumn('backlog')
    useKanbanStore.getState().setActiveBoard('future')
    expect(useKanbanStore.getState().collapsedColumns['backlog']).toBe(true)
  })
})
