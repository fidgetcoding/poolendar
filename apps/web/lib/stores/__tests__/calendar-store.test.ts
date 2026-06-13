import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

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

import { useCalendarStore } from '../calendar-store'

// ---------------------------------------------------------------------------
// Reset store between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  storage.clear()
  useCalendarStore.setState(useCalendarStore.getInitialState(), true)
})

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('CalendarStore - Initial state', () => {
  it('defaults to week view', () => {
    expect(useCalendarStore.getState().view).toBe('week')
  })

  it('selectedDate is today in yyyy-MM-dd format', () => {
    const today = new Date()
    const yyyy = String(today.getFullYear())
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    expect(useCalendarStore.getState().selectedDate).toBe(`${yyyy}-${mm}-${dd}`)
  })

  it('no item is selected', () => {
    const state = useCalendarStore.getState()
    expect(state.selectedItemId).toBeNull()
    expect(state.selectedItemType).toBeNull()
  })

  it('hourHeight defaults to 60', () => {
    expect(useCalendarStore.getState().hourHeight).toBe(60)
  })

  it('drag state is idle', () => {
    const { drag } = useCalendarStore.getState()
    expect(drag.isDragging).toBe(false)
    expect(drag.dragType).toBeNull()
    expect(drag.dragItemId).toBeNull()
  })

  it('display settings have correct defaults', () => {
    const state = useCalendarStore.getState()
    expect(state.showWeekends).toBe(true)
    expect(state.widenCurrentDay).toBe(false)
    expect(state.dimPastEvents).toBe(true)
    expect(state.showCompletedTasks).toBe(false)
    expect(state.showDeclinedEvents).toBe(false)
    expect(state.mergeDuplicateEvents).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// View management
// ---------------------------------------------------------------------------

describe('CalendarStore - setView', () => {
  it('changes view to month', () => {
    useCalendarStore.getState().setView('month')
    expect(useCalendarStore.getState().view).toBe('month')
  })

  it('changes view to day', () => {
    useCalendarStore.getState().setView('day')
    expect(useCalendarStore.getState().view).toBe('day')
  })

  it('changes view to 2weeks', () => {
    useCalendarStore.getState().setView('2weeks')
    expect(useCalendarStore.getState().view).toBe('2weeks')
  })

  it('changes view to custom', () => {
    useCalendarStore.getState().setView('custom')
    expect(useCalendarStore.getState().view).toBe('custom')
  })
})

// ---------------------------------------------------------------------------
// Date selection
// ---------------------------------------------------------------------------

describe('CalendarStore - setSelectedDate', () => {
  it('updates selected date', () => {
    useCalendarStore.getState().setSelectedDate('2026-03-15')
    expect(useCalendarStore.getState().selectedDate).toBe('2026-03-15')
  })
})

// ---------------------------------------------------------------------------
// Item selection
// ---------------------------------------------------------------------------

describe('CalendarStore - selectItem / clearSelection', () => {
  it('stores selected item id and type', () => {
    useCalendarStore.getState().selectItem('evt-123', 'event')
    const state = useCalendarStore.getState()
    expect(state.selectedItemId).toBe('evt-123')
    expect(state.selectedItemType).toBe('event')
  })

  it('allows task selection', () => {
    useCalendarStore.getState().selectItem('task-1', 'task')
    expect(useCalendarStore.getState().selectedItemType).toBe('task')
  })

  it('allows routine selection', () => {
    useCalendarStore.getState().selectItem('r-1', 'routine')
    expect(useCalendarStore.getState().selectedItemType).toBe('routine')
  })

  it('clears selection', () => {
    useCalendarStore.getState().selectItem('evt-123', 'event')
    useCalendarStore.getState().clearSelection()
    const state = useCalendarStore.getState()
    expect(state.selectedItemId).toBeNull()
    expect(state.selectedItemType).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

describe('CalendarStore - navigation', () => {
  beforeEach(() => {
    // Pin to a known date so arithmetic is deterministic
    useCalendarStore.getState().setSelectedDate('2026-06-15')
  })

  describe('day view', () => {
    beforeEach(() => useCalendarStore.getState().setView('day'))

    it('goToNextPeriod advances by 1 day', () => {
      useCalendarStore.getState().goToNextPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-16')
    })

    it('goToPrevPeriod goes back by 1 day', () => {
      useCalendarStore.getState().goToPrevPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-14')
    })
  })

  describe('week view', () => {
    beforeEach(() => useCalendarStore.getState().setView('week'))

    it('goToNextPeriod advances by 7 days', () => {
      useCalendarStore.getState().goToNextPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-22')
    })

    it('goToPrevPeriod goes back by 7 days', () => {
      useCalendarStore.getState().goToPrevPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-08')
    })
  })

  describe('month view', () => {
    beforeEach(() => useCalendarStore.getState().setView('month'))

    it('goToNextPeriod advances by 1 month', () => {
      useCalendarStore.getState().goToNextPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-07-15')
    })

    it('goToPrevPeriod goes back by 1 month', () => {
      useCalendarStore.getState().goToPrevPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-05-15')
    })
  })

  describe('2weeks view', () => {
    beforeEach(() => useCalendarStore.getState().setView('2weeks'))

    it('goToNextPeriod advances by 14 days', () => {
      useCalendarStore.getState().goToNextPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-29')
    })

    it('goToPrevPeriod goes back by 14 days', () => {
      useCalendarStore.getState().goToPrevPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-01')
    })
  })

  describe('custom view', () => {
    beforeEach(() => {
      useCalendarStore.getState().setView('custom')
      useCalendarStore.getState().setCustomDays(5)
    })

    it('goToNextPeriod advances by customDays', () => {
      useCalendarStore.getState().goToNextPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-20')
    })

    it('goToPrevPeriod goes back by customDays', () => {
      useCalendarStore.getState().goToPrevPeriod()
      expect(useCalendarStore.getState().selectedDate).toBe('2026-06-10')
    })
  })

  it('goToToday resets to today', () => {
    useCalendarStore.getState().setSelectedDate('2020-01-01')
    useCalendarStore.getState().goToToday()
    const today = new Date()
    const yyyy = String(today.getFullYear())
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    expect(useCalendarStore.getState().selectedDate).toBe(`${yyyy}-${mm}-${dd}`)
  })
})

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

describe('CalendarStore - zoom', () => {
  it('zoomIn increases hourHeight by 15', () => {
    useCalendarStore.getState().zoomIn()
    expect(useCalendarStore.getState().hourHeight).toBe(75)
  })

  it('zoomOut decreases hourHeight by 15', () => {
    useCalendarStore.getState().zoomOut()
    expect(useCalendarStore.getState().hourHeight).toBe(45)
  })

  it('zoomIn caps at 120', () => {
    // Start at 60, zoom in 5 times = 60+75 = would be 135 but capped
    for (let i = 0; i < 10; i++) useCalendarStore.getState().zoomIn()
    expect(useCalendarStore.getState().hourHeight).toBe(120)
  })

  it('zoomOut floors at 30', () => {
    for (let i = 0; i < 10; i++) useCalendarStore.getState().zoomOut()
    expect(useCalendarStore.getState().hourHeight).toBe(30)
  })

  it('setHourHeight clamps within min/max bounds', () => {
    useCalendarStore.getState().setHourHeight(200)
    expect(useCalendarStore.getState().hourHeight).toBe(120)

    useCalendarStore.getState().setHourHeight(5)
    expect(useCalendarStore.getState().hourHeight).toBe(30)

    useCalendarStore.getState().setHourHeight(80)
    expect(useCalendarStore.getState().hourHeight).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// Custom days
// ---------------------------------------------------------------------------

describe('CalendarStore - setCustomDays', () => {
  it('clamps to minimum of 1', () => {
    useCalendarStore.getState().setCustomDays(0)
    expect(useCalendarStore.getState().customDays).toBe(1)
  })

  it('clamps to maximum of 9', () => {
    useCalendarStore.getState().setCustomDays(15)
    expect(useCalendarStore.getState().customDays).toBe(9)
  })

  it('accepts valid value', () => {
    useCalendarStore.getState().setCustomDays(5)
    expect(useCalendarStore.getState().customDays).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Calendar visibility
// ---------------------------------------------------------------------------

describe('CalendarStore - calendar visibility', () => {
  it('toggleCalendarVisibility adds a calendar id', () => {
    useCalendarStore.getState().toggleCalendarVisibility('cal-1')
    expect(useCalendarStore.getState().visibleCalendarIds.has('cal-1')).toBe(true)
  })

  it('toggleCalendarVisibility removes on second call', () => {
    useCalendarStore.getState().toggleCalendarVisibility('cal-1')
    useCalendarStore.getState().toggleCalendarVisibility('cal-1')
    expect(useCalendarStore.getState().visibleCalendarIds.has('cal-1')).toBe(false)
  })

  it('toggleCalendarVisibility clears soloCalendarId', () => {
    useCalendarStore.getState().soloCalendar('cal-1')
    useCalendarStore.getState().toggleCalendarVisibility('cal-2')
    expect(useCalendarStore.getState().soloCalendarId).toBeNull()
  })

  it('setAllCalendarsVisible replaces the set', () => {
    useCalendarStore.getState().toggleCalendarVisibility('cal-1')
    useCalendarStore.getState().setAllCalendarsVisible(['cal-a', 'cal-b'])
    const ids = useCalendarStore.getState().visibleCalendarIds
    expect(ids.has('cal-a')).toBe(true)
    expect(ids.has('cal-b')).toBe(true)
    expect(ids.has('cal-1')).toBe(false)
  })

  it('soloCalendar sets the solo id', () => {
    useCalendarStore.getState().soloCalendar('cal-x')
    expect(useCalendarStore.getState().soloCalendarId).toBe('cal-x')
  })

  it('soloCalendar toggles off when called with same id', () => {
    useCalendarStore.getState().soloCalendar('cal-x')
    useCalendarStore.getState().soloCalendar('cal-x')
    expect(useCalendarStore.getState().soloCalendarId).toBeNull()
  })

  it('soloCalendar clears on null', () => {
    useCalendarStore.getState().soloCalendar('cal-x')
    useCalendarStore.getState().soloCalendar(null)
    expect(useCalendarStore.getState().soloCalendarId).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Display settings
// ---------------------------------------------------------------------------

describe('CalendarStore - display settings', () => {
  it('setShowWeekends', () => {
    useCalendarStore.getState().setShowWeekends(false)
    expect(useCalendarStore.getState().showWeekends).toBe(false)
  })

  it('setWidenCurrentDay', () => {
    useCalendarStore.getState().setWidenCurrentDay(true)
    expect(useCalendarStore.getState().widenCurrentDay).toBe(true)
  })

  it('setDimPastEvents', () => {
    useCalendarStore.getState().setDimPastEvents(false)
    expect(useCalendarStore.getState().dimPastEvents).toBe(false)
  })

  it('setShowCompletedTasks', () => {
    useCalendarStore.getState().setShowCompletedTasks(true)
    expect(useCalendarStore.getState().showCompletedTasks).toBe(true)
  })

  it('setShowDeclinedEvents', () => {
    useCalendarStore.getState().setShowDeclinedEvents(true)
    expect(useCalendarStore.getState().showDeclinedEvents).toBe(true)
  })

  it('setMergeDuplicateEvents', () => {
    useCalendarStore.getState().setMergeDuplicateEvents(true)
    expect(useCalendarStore.getState().mergeDuplicateEvents).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Drag state
// ---------------------------------------------------------------------------

describe('CalendarStore - drag', () => {
  it('startDrag sets isDragging and drag fields', () => {
    useCalendarStore.getState().startDrag({
      dragType: 'move',
      dragItemId: 'evt-1',
      dragStartTime: '09:00',
      dragCurrentTime: '09:00',
      dragStartDate: '2026-06-15',
      dragCurrentDate: '2026-06-15',
    })
    const { drag } = useCalendarStore.getState()
    expect(drag.isDragging).toBe(true)
    expect(drag.dragType).toBe('move')
    expect(drag.dragItemId).toBe('evt-1')
  })

  it('updateDrag updates current time and date', () => {
    useCalendarStore.getState().startDrag({
      dragType: 'resize',
      dragItemId: 'evt-1',
      dragStartTime: '09:00',
      dragCurrentTime: '09:00',
      dragStartDate: '2026-06-15',
      dragCurrentDate: '2026-06-15',
    })
    useCalendarStore.getState().updateDrag('10:30', '2026-06-16')
    const { drag } = useCalendarStore.getState()
    expect(drag.dragCurrentTime).toBe('10:30')
    expect(drag.dragCurrentDate).toBe('2026-06-16')
  })

  it('endDrag resets drag state', () => {
    useCalendarStore.getState().startDrag({
      dragType: 'create',
      dragItemId: null,
      dragStartTime: '14:00',
      dragCurrentTime: '14:00',
      dragStartDate: '2026-06-15',
      dragCurrentDate: '2026-06-15',
    })
    useCalendarStore.getState().endDrag()
    const { drag } = useCalendarStore.getState()
    expect(drag.isDragging).toBe(false)
    expect(drag.dragType).toBeNull()
    expect(drag.dragItemId).toBeNull()
  })
})
