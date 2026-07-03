// ---------------------------------------------------------------------------
// Command-bar action table (#72b). Pure: given a set of handlers it returns the
// ordered action list the palette renders and dispatches. Kept free of React /
// store imports so the dispatch wiring can be unit-tested with mock handlers.
// ---------------------------------------------------------------------------

export type CommandGroup = 'Actions' | 'Navigation' | 'Shortcuts'

export interface CommandAction {
  id: string
  group: CommandGroup
  label: string
  /** Display hint for the hotkey, e.g. "C", "⌥A". */
  shortcut?: string
  run: () => void
}

export interface CommandActionHandlers {
  createEvent: () => void
  createTask: () => void
  createRoutine: () => void
  createBookingLink: () => void
  refreshCalendars: () => void
  goToToday: () => void
  dayView: () => void
  weekView: () => void
  monthView: () => void
  twoWeekView: () => void
  openKanban: () => void
  prevPeriod: () => void
  nextPeriod: () => void
  openSettings: () => void
  toggleTaskPanel: () => void
  toggleBookingPanel: () => void
  toggleSidebar: () => void
  listShortcuts: () => void
}

export function buildCommandActions(h: CommandActionHandlers): CommandAction[] {
  return [
    // Actions
    { id: 'create-event', group: 'Actions', label: 'Create Event', shortcut: 'C', run: h.createEvent },
    { id: 'create-task', group: 'Actions', label: 'Create Task', shortcut: 'N T', run: h.createTask },
    { id: 'create-routine', group: 'Actions', label: 'Create Routine', run: h.createRoutine },
    { id: 'create-booking-link', group: 'Actions', label: 'Create Booking Link', run: h.createBookingLink },
    { id: 'refresh-calendars', group: 'Actions', label: 'Refresh Calendars', shortcut: 'R', run: h.refreshCalendars },

    // Navigation
    { id: 'go-to-today', group: 'Navigation', label: 'Go to Today', shortcut: 'T', run: h.goToToday },
    { id: 'day-view', group: 'Navigation', label: 'Day View', shortcut: 'D', run: h.dayView },
    { id: 'week-view', group: 'Navigation', label: 'Week View', shortcut: 'W', run: h.weekView },
    { id: 'month-view', group: 'Navigation', label: 'Month View', shortcut: 'M', run: h.monthView },
    { id: 'two-week-view', group: 'Navigation', label: '2 Weeks View', shortcut: 'X', run: h.twoWeekView },
    { id: 'open-kanban', group: 'Navigation', label: 'Open Kanban Board', run: h.openKanban },
    { id: 'prev-period', group: 'Navigation', label: 'Previous Period', shortcut: '←', run: h.prevPeriod },
    { id: 'next-period', group: 'Navigation', label: 'Next Period', shortcut: '→', run: h.nextPeriod },

    // Shortcuts
    { id: 'open-settings', group: 'Shortcuts', label: 'Open Settings', shortcut: 'P', run: h.openSettings },
    { id: 'toggle-task-panel', group: 'Shortcuts', label: 'Toggle Task Panel', shortcut: '⌥A', run: h.toggleTaskPanel },
    { id: 'toggle-booking-panel', group: 'Shortcuts', label: 'Toggle Booking Panel', shortcut: '⌥S', run: h.toggleBookingPanel },
    { id: 'toggle-sidebar', group: 'Shortcuts', label: 'Toggle Sidebar', shortcut: 'Space', run: h.toggleSidebar },
    { id: 'list-shortcuts', group: 'Shortcuts', label: 'List Keyboard Shortcuts', shortcut: '.', run: h.listShortcuts },
  ]
}
