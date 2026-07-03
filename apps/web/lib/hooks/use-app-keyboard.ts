'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'

// ---------------------------------------------------------------------------
// Global keyboard shortcut listener (#71). The store-only shortcuts (views,
// navigation, zoom, panels) are handled inline via getState(); anything that
// needs the shared undo engine, the command bar, or app chrome is injected as a
// handler. Behavior here is the runtime companion to SHORTCUT_DEFINITIONS in
// use-keyboard.ts — the ShortcutsTab and the `.` overlay render from that same
// source so the list can never drift from what actually fires.
// ---------------------------------------------------------------------------

export interface AppKeyboardHandlers {
  undo: () => void
  redo: () => void
  toggleCommandBar: () => void
  openCommandSearch: () => void
  closeCommandBar: () => void
  openSettings: () => void
  refreshCalendars: () => void
  showShortcuts: () => void
  deleteSelected: () => void
  splitSelected: () => void
}

const SEQUENCE_WINDOW_MS = 800

export function useAppKeyboard(handlers: AppKeyboardHandlers) {
  // Keep the latest handlers without re-registering the listener each render.
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  // Tracks an in-flight "N then T" chord.
  const pendingNRef = useRef<number>(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const h = handlersRef.current
    const calendarStore = useCalendarStore.getState()
    const uiStore = useUIStore.getState()

    const target = e.target as HTMLElement
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable

    const meta = e.metaKey || e.ctrlKey

    // --- Global (fire even inside inputs) ---

    // Command bar: ⌘K
    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      h.toggleCommandBar()
      return
    }

    // Search: ⌘F
    if (meta && e.key.toLowerCase() === 'f' && !e.shiftKey) {
      e.preventDefault()
      h.openCommandSearch()
      return
    }

    // Undo / redo: ⌘Z / ⌘⇧Z
    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) h.redo()
      else h.undo()
      return
    }

    if (e.key === 'Escape') {
      // Esc closes the command bar and any open preview (creation/discard, #71).
      uiStore.closePreviewPopover()
      h.closeCommandBar()
      // Don't return — allow the edit form's own Esc handler to run too.
    }

    if (isInput) return

    // --- Alt combos ---
    if (e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'a') {
        e.preventDefault()
        uiStore.toggleTaskPanel()
        return
      }
      if (k === 's') {
        e.preventDefault()
        uiStore.toggleBookingPanel()
        return
      }
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        calendarStore.setCustomDays(parseInt(e.key, 10))
        calendarStore.setView('custom')
        return
      }
      return
    }

    if (meta) return

    // "N then T" chord → new task (#71).
    const now = Date.now()
    if (e.key.toLowerCase() === 'n') {
      pendingNRef.current = now
      return
    }
    const nRecent = now - pendingNRef.current < SEQUENCE_WINDOW_MS
    pendingNRef.current = 0

    switch (e.key) {
      case 'T':
      case 't':
        if (nRecent) uiStore.openEditForm(null, 'task')
        else calendarStore.goToToday()
        break
      case 'D':
      case 'd':
        calendarStore.setView('day')
        break
      case 'W':
      case 'w':
        calendarStore.setView('week')
        break
      case 'M':
      case 'm':
        calendarStore.setView('month')
        break
      case 'X':
      case 'x':
        calendarStore.setView('2weeks')
        break
      case 'P':
      case 'p':
        e.preventDefault()
        h.openSettings()
        break
      case 'R':
      case 'r':
        if (e.shiftKey) {
          // ⇧R reschedule — open the selected item's form (focused on its time).
          const { selectedItemId, selectedItemType } = calendarStore
          if (selectedItemId && selectedItemType) {
            uiStore.openEditForm(selectedItemId, selectedItemType)
          }
        } else {
          h.refreshCalendars()
        }
        break
      case 'S':
      case 's':
        if (e.shiftKey) h.splitSelected()
        break
      case 'C':
      case 'c':
        uiStore.openEditForm(null, 'event')
        break
      case 'E':
      case 'e': {
        const { selectedItemId, selectedItemType } = calendarStore
        if (selectedItemId && selectedItemType) {
          uiStore.openEditForm(selectedItemId, selectedItemType)
        }
        break
      }
      case 'Delete':
      case 'Backspace':
        h.deleteSelected()
        break
      case 'ArrowLeft':
        calendarStore.goToPrevPeriod()
        break
      case 'ArrowRight':
        calendarStore.goToNextPeriod()
        break
      case '.':
        h.showShortcuts()
        break
      case '?':
      case '/':
        e.preventDefault()
        h.showShortcuts()
        break
      case '[':
        calendarStore.zoomOut()
        break
      case ']':
        calendarStore.zoomIn()
        break
      case ' ':
        e.preventDefault()
        uiStore.toggleSidebar()
        break
      default:
        break
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
