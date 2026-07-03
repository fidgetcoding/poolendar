'use client'

import { useCallback, useEffect } from 'react'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'

interface AppKeyboardHandlers {
  undo: () => void
  redo: () => void
  toggleCommandBar: () => void
  openCommandBar: () => void
  openSettings: () => void
}

/**
 * Global keyboard shortcut listener (#71). Extracted from the app layout to keep
 * that file under the 500-line cap. Store actions are read via getState() so the
 * handler stays dependency-light.
 */
export function useAppKeyboard({
  undo,
  redo,
  toggleCommandBar,
  openCommandBar,
  openSettings,
}: AppKeyboardHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const calendarStore = useCalendarStore.getState()
      const uiStore = useUIStore.getState()

      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      // Command bar: Cmd+K / Ctrl+K (always active)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggleCommandBar()
        return
      }

      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault()
          undo()
        }
        return
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (!isInput) {
          e.preventDefault()
          redo()
        }
        return
      }

      if (isInput) return

      // Alt combos
      if (e.altKey) {
        switch (e.key) {
          case 'a':
          case 'A':
            e.preventDefault()
            uiStore.toggleTaskPanel()
            return
          case 's':
          case 'S':
            e.preventDefault()
            uiStore.toggleBookingPanel()
            return
          default:
            if (e.key >= '1' && e.key <= '9') {
              e.preventDefault()
              calendarStore.setCustomDays(parseInt(e.key, 10))
              calendarStore.setView('custom')
            }
            return
        }
      }

      switch (e.key) {
        case 'T':
        case 't':
          calendarStore.goToToday()
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
          openSettings()
          break
        case 'R':
        case 'r':
          // Refresh calendars — integration point
          break
        case 'C':
        case 'c':
          uiStore.openEditForm(null, 'event')
          break
        case 'ArrowLeft':
          calendarStore.goToPrevPeriod()
          break
        case 'ArrowRight':
          calendarStore.goToNextPeriod()
          break
        case '.':
          openCommandBar()
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
    },
    [undo, redo, toggleCommandBar, openCommandBar, openSettings]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
