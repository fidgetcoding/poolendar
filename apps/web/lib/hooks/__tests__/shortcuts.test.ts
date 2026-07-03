import { describe, it, expect } from 'vitest'
import { SHORTCUT_DEFINITIONS, formatShortcut, type ShortcutName } from '../use-keyboard'

// Every shortcut listed in PRODUCT.md #71 must be represented by a single
// definition so the live handler, the Settings > Shortcuts tab, and the `.`
// overlay all render from one source that can't drift.
const REQUIRED: ShortcutName[] = [
  // General
  'search', 'preferences', 'undo', 'listShortcuts', 'help', 'zoomIn', 'zoomOut',
  // Quick access
  'commandBar', 'toggleTaskPanel', 'toggleBookingPanel', 'toggleDrawer',
  // Calendar views
  'refreshCalendars', 'today', 'nextPeriod', 'prevPeriod',
  'dayView', 'weekView', 'monthView', 'twoWeekView',
  'customDays1', 'customDays2', 'customDays3', 'customDays4', 'customDays5',
  'customDays6', 'customDays7', 'customDays8', 'customDays9',
  // Events & tasks
  'createEvent', 'newTask', 'editSelected', 'deleteSelected', 'discardCreation',
  'save', 'copy', 'paste', 'reschedule', 'followUp', 'split',
]

describe('SHORTCUT_DEFINITIONS completeness (#71)', () => {
  it('defines every shortcut required by the spec', () => {
    for (const name of REQUIRED) {
      expect(SHORTCUT_DEFINITIONS[name], `missing shortcut: ${name}`).toBeDefined()
    }
  })

  it('every definition carries a key, label, and category', () => {
    for (const [name, def] of Object.entries(SHORTCUT_DEFINITIONS)) {
      expect(def.key, `${name}.key`).toBeTruthy()
      expect(def.label, `${name}.label`).toBeTruthy()
      expect(def.category, `${name}.category`).toBeTruthy()
    }
  })

  it('groups shortcuts into the four spec categories', () => {
    const categories = new Set(Object.values(SHORTCUT_DEFINITIONS).map((d) => d.category))
    expect(categories).toEqual(new Set(['general', 'quick_access', 'calendar', 'items']))
  })

  it('formats modifier chords', () => {
    expect(formatShortcut(SHORTCUT_DEFINITIONS.commandBar)).toMatch(/K$/)
    expect(formatShortcut(SHORTCUT_DEFINITIONS.split)).toMatch(/S$/)
  })
})
