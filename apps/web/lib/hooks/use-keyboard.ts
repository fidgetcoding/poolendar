'use client'

import { useEffect, useRef, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutConfig {
  key: string
  meta?: boolean
  alt?: boolean
  shift?: boolean
  handler: () => void
  /** If true, shortcut fires even when an input/textarea is focused */
  global?: boolean
}

interface ShortcutDefinition {
  key: string
  meta?: boolean
  alt?: boolean
  shift?: boolean
  label: string
  category: string
  global?: boolean
}

// ---------------------------------------------------------------------------
// Shortcut definitions
// ---------------------------------------------------------------------------

export const SHORTCUT_DEFINITIONS = {
  // General
  search: { key: 'f', meta: true, label: 'Search', category: 'general' },
  preferences: { key: 'p', label: 'Preferences', category: 'general' },
  undo: { key: 'z', meta: true, label: 'Undo', category: 'general' },
  redo: { key: 'z', meta: true, shift: true, label: 'Redo', category: 'general' },
  listShortcuts: { key: '.', label: 'List shortcuts', category: 'general' },
  help: { key: '/', label: 'Help', category: 'general' },
  zoomIn: { key: ']', label: 'Increase time resolution', category: 'general' },
  zoomOut: { key: '[', label: 'Reduce time resolution', category: 'general' },

  // Quick access
  commandBar: { key: 'k', meta: true, label: 'Command bar', category: 'quick_access' },
  toggleTaskPanel: { key: 'a', alt: true, label: 'Toggle task panel', category: 'quick_access' },
  toggleBookingPanel: { key: 's', alt: true, label: 'Toggle booking panel', category: 'quick_access' },
  toggleDrawer: { key: ' ', label: 'Toggle left drawer', category: 'quick_access' },

  // Calendar views
  refreshCalendars: { key: 'r', label: 'Refresh calendars', category: 'calendar' },
  today: { key: 't', label: 'Jump to today', category: 'calendar' },
  nextPeriod: { key: 'ArrowRight', label: 'Next period', category: 'calendar' },
  prevPeriod: { key: 'ArrowLeft', label: 'Previous period', category: 'calendar' },
  dayView: { key: 'd', label: 'Day view', category: 'calendar' },
  weekView: { key: 'w', label: 'Week view', category: 'calendar' },
  monthView: { key: 'm', label: 'Month view', category: 'calendar' },
  twoWeekView: { key: 'x', label: '2 weeks view', category: 'calendar' },
  customDays1: { key: '1', alt: true, label: '1 day', category: 'calendar' },
  customDays2: { key: '2', alt: true, label: '2 days', category: 'calendar' },
  customDays3: { key: '3', alt: true, label: '3 days', category: 'calendar' },
  customDays4: { key: '4', alt: true, label: '4 days', category: 'calendar' },
  customDays5: { key: '5', alt: true, label: '5 days', category: 'calendar' },
  customDays6: { key: '6', alt: true, label: '6 days', category: 'calendar' },
  customDays7: { key: '7', alt: true, label: '7 days', category: 'calendar' },
  customDays8: { key: '8', alt: true, label: '8 days', category: 'calendar' },
  customDays9: { key: '9', alt: true, label: '9 days', category: 'calendar' },

  // Events and tasks
  createEvent: { key: 'c', label: 'Create event', category: 'items' },
  editSelected: { key: 'e', label: 'Edit selected', category: 'items' },
  deleteSelected: { key: 'Delete', label: 'Delete selected', category: 'items' },
  deleteSelectedAlt: { key: 'Backspace', label: 'Delete selected', category: 'items' },
  discardCreation: { key: 'Escape', label: 'Discard creation', category: 'items', global: true },
  save: { key: 'Enter', meta: true, label: 'Save', category: 'items', global: true },
  copy: { key: 'c', meta: true, label: 'Copy', category: 'items', global: true },
  paste: { key: 'v', meta: true, label: 'Paste', category: 'items', global: true },
  reschedule: { key: 'r', shift: true, label: 'Reschedule', category: 'items' },
  followUp: { key: 'f', shift: true, label: 'Schedule follow-up', category: 'items' },
  split: { key: 's', shift: true, label: 'Split and reschedule', category: 'items' },
} as const satisfies Record<string, ShortcutDefinition>

export type ShortcutName = keyof typeof SHORTCUT_DEFINITIONS

// ---------------------------------------------------------------------------
// Format helper
// ---------------------------------------------------------------------------

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

/**
 * Returns a human-readable shortcut string.
 * Mac: ⌘K, ⌥A, ⇧S   Windows/Linux: Ctrl+K, Alt+A, Shift+S
 */
export function formatShortcut(def: {
  key: string
  meta?: boolean
  alt?: boolean
  shift?: boolean
}): string {
  const parts: string[] = []

  if (IS_MAC) {
    if (def.meta) parts.push('⌘')
    if (def.alt) parts.push('⌥')
    if (def.shift) parts.push('⇧')
  } else {
    if (def.meta) parts.push('Ctrl+')
    if (def.alt) parts.push('Alt+')
    if (def.shift) parts.push('Shift+')
  }

  // Normalize display key
  const displayKey = DISPLAY_KEY_MAP[def.key] ?? def.key.toUpperCase()
  parts.push(displayKey)

  return parts.join('')
}

const DISPLAY_KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Enter: '⏎',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function isEditableElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function matchesShortcut(e: KeyboardEvent, sc: ShortcutConfig): boolean {
  // Normalize the key comparison — single-char keys are case-insensitive
  const eventKey = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const scKey = sc.key.length === 1 ? sc.key.toLowerCase() : sc.key

  if (eventKey !== scKey) return false
  if (!!sc.meta !== (e.metaKey || e.ctrlKey)) return false
  if (!!sc.alt !== e.altKey) return false
  if (!!sc.shift !== e.shiftKey) return false
  return true
}

export function useKeyboard(shortcuts: ShortcutConfig[]) {
  // Store shortcuts in a ref so the listener always sees the latest
  // handlers without re-registering the event listener on every render.
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const active = document.activeElement
    const inEditable = isEditableElement(active)

    for (const sc of shortcutsRef.current) {
      if (inEditable && !sc.global) continue
      if (matchesShortcut(e, sc)) {
        e.preventDefault()
        sc.handler()
        return
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
