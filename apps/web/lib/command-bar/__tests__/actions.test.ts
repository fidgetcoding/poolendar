import { describe, it, expect, vi } from 'vitest'
import { buildCommandActions, type CommandActionHandlers } from '../actions'

function mockHandlers(): CommandActionHandlers {
  return {
    createEvent: vi.fn(),
    createTask: vi.fn(),
    createRoutine: vi.fn(),
    createBookingLink: vi.fn(),
    refreshCalendars: vi.fn(),
    goToToday: vi.fn(),
    dayView: vi.fn(),
    weekView: vi.fn(),
    monthView: vi.fn(),
    twoWeekView: vi.fn(),
    openKanban: vi.fn(),
    prevPeriod: vi.fn(),
    nextPeriod: vi.fn(),
    openSettings: vi.fn(),
    toggleTaskPanel: vi.fn(),
    toggleBookingPanel: vi.fn(),
    toggleSidebar: vi.fn(),
    listShortcuts: vi.fn(),
  }
}

// action id -> the handler key it must dispatch to
const DISPATCH: Record<string, keyof CommandActionHandlers> = {
  'create-event': 'createEvent',
  'create-task': 'createTask',
  'create-routine': 'createRoutine',
  'create-booking-link': 'createBookingLink',
  'refresh-calendars': 'refreshCalendars',
  'go-to-today': 'goToToday',
  'day-view': 'dayView',
  'week-view': 'weekView',
  'month-view': 'monthView',
  'two-week-view': 'twoWeekView',
  'open-kanban': 'openKanban',
  'prev-period': 'prevPeriod',
  'next-period': 'nextPeriod',
  'open-settings': 'openSettings',
  'toggle-task-panel': 'toggleTaskPanel',
  'toggle-booking-panel': 'toggleBookingPanel',
  'toggle-sidebar': 'toggleSidebar',
  'list-shortcuts': 'listShortcuts',
}

describe('buildCommandActions', () => {
  it('produces one action per handler', () => {
    const actions = buildCommandActions(mockHandlers())
    expect(actions).toHaveLength(Object.keys(DISPATCH).length)
  })

  it('assigns every action to a known group', () => {
    const actions = buildCommandActions(mockHandlers())
    for (const a of actions) {
      expect(['Actions', 'Navigation', 'Shortcuts']).toContain(a.group)
    }
  })

  it('dispatches each action to exactly its handler', () => {
    for (const [id, handlerKey] of Object.entries(DISPATCH)) {
      const handlers = mockHandlers()
      const actions = buildCommandActions(handlers)
      const action = actions.find((a) => a.id === id)
      expect(action, `action ${id} exists`).toBeDefined()

      action!.run()

      expect(handlers[handlerKey], `${id} -> ${handlerKey}`).toHaveBeenCalledTimes(1)
      // No other handler should have fired.
      for (const [key, fn] of Object.entries(handlers)) {
        if (key !== handlerKey) expect(fn).not.toHaveBeenCalled()
      }
    }
  })
})
