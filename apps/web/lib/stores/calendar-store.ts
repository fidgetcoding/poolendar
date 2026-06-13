'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, addMonths, subMonths, format } from 'date-fns'

type CalendarView = 'day' | 'week' | 'month' | '2weeks' | 'custom'

interface DragState {
  isDragging: boolean
  dragType: 'move' | 'resize' | 'create' | null
  dragItemId: string | null
  dragStartTime: string | null
  dragCurrentTime: string | null
  dragStartDate: string | null
  dragCurrentDate: string | null
}

const initialDragState: DragState = {
  isDragging: false,
  dragType: null,
  dragItemId: null,
  dragStartTime: null,
  dragCurrentTime: null,
  dragStartDate: null,
  dragCurrentDate: null,
}

interface CalendarState {
  // View state
  view: CalendarView
  customDays: number
  selectedDate: string

  // Selection
  selectedItemId: string | null
  selectedItemType: 'event' | 'task' | 'routine' | null

  // Visible calendars
  visibleCalendarIds: Set<string>
  soloCalendarId: string | null

  // Zoom
  hourHeight: number

  // Display settings (persisted)
  showWeekends: boolean
  widenCurrentDay: boolean
  dimPastEvents: boolean
  showCompletedTasks: boolean
  showDeclinedEvents: boolean
  mergeDuplicateEvents: boolean

  // Drag state
  drag: DragState

  // Actions
  setView: (view: CalendarView) => void
  setCustomDays: (days: number) => void
  setSelectedDate: (date: string) => void
  goToToday: () => void
  goToPrevPeriod: () => void
  goToNextPeriod: () => void
  selectItem: (id: string | null, type: 'event' | 'task' | 'routine' | null) => void
  clearSelection: () => void
  toggleCalendarVisibility: (calendarId: string) => void
  setAllCalendarsVisible: (ids: string[]) => void
  soloCalendar: (calendarId: string | null) => void
  zoomIn: () => void
  zoomOut: () => void
  setHourHeight: (height: number) => void
  setShowWeekends: (show: boolean) => void
  setWidenCurrentDay: (widen: boolean) => void
  setDimPastEvents: (dim: boolean) => void
  setShowCompletedTasks: (show: boolean) => void
  setShowDeclinedEvents: (show: boolean) => void
  setMergeDuplicateEvents: (merge: boolean) => void
  startDrag: (drag: Omit<DragState, 'isDragging'>) => void
  updateDrag: (time: string, date: string) => void
  endDrag: () => void
}

function navigateDate(
  currentDate: string,
  view: CalendarView,
  customDays: number,
  direction: 'prev' | 'next'
): string {
  const date = new Date(currentDate + 'T00:00:00')
  const sign = direction === 'next' ? 1 : -1

  switch (view) {
    case 'day':
      return format(addDays(date, sign * 1), 'yyyy-MM-dd')
    case 'week':
      return format(addDays(date, sign * 7), 'yyyy-MM-dd')
    case 'month':
      return format(
        direction === 'next' ? addMonths(date, 1) : subMonths(date, 1),
        'yyyy-MM-dd'
      )
    case '2weeks':
      return format(addDays(date, sign * 14), 'yyyy-MM-dd')
    case 'custom':
      return format(addDays(date, sign * customDays), 'yyyy-MM-dd')
  }
}

const MIN_HOUR_HEIGHT = 30
const MAX_HOUR_HEIGHT = 120
const ZOOM_STEP = 15

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      // View state
      view: 'week',
      customDays: 3,
      selectedDate: format(new Date(), 'yyyy-MM-dd'),

      // Selection
      selectedItemId: null,
      selectedItemType: null,

      // Visible calendars
      visibleCalendarIds: new Set<string>(),
      soloCalendarId: null,

      // Zoom
      hourHeight: 60,

      // Display settings
      showWeekends: true,
      widenCurrentDay: false,
      dimPastEvents: true,
      showCompletedTasks: false,
      showDeclinedEvents: false,
      mergeDuplicateEvents: false,

      // Drag state
      drag: { ...initialDragState },

      // Actions
      setView: (view) => set({ view }),

      setCustomDays: (days) =>
        set({ customDays: Math.max(1, Math.min(9, days)) }),

      setSelectedDate: (date) => set({ selectedDate: date }),

      goToToday: () => set({ selectedDate: format(new Date(), 'yyyy-MM-dd') }),

      goToPrevPeriod: () => {
        const { selectedDate, view, customDays } = get()
        set({ selectedDate: navigateDate(selectedDate, view, customDays, 'prev') })
      },

      goToNextPeriod: () => {
        const { selectedDate, view, customDays } = get()
        set({ selectedDate: navigateDate(selectedDate, view, customDays, 'next') })
      },

      selectItem: (id, type) =>
        set({ selectedItemId: id, selectedItemType: type }),

      clearSelection: () =>
        set({ selectedItemId: null, selectedItemType: null }),

      toggleCalendarVisibility: (calendarId) =>
        set((state) => {
          const next = new Set(state.visibleCalendarIds)
          if (next.has(calendarId)) {
            next.delete(calendarId)
          } else {
            next.add(calendarId)
          }
          return { visibleCalendarIds: next, soloCalendarId: null }
        }),

      setAllCalendarsVisible: (ids) =>
        set({ visibleCalendarIds: new Set(ids), soloCalendarId: null }),

      soloCalendar: (calendarId) =>
        set((state) => {
          if (calendarId === null || state.soloCalendarId === calendarId) {
            return { soloCalendarId: null }
          }
          return { soloCalendarId: calendarId }
        }),

      zoomIn: () =>
        set((state) => ({
          hourHeight: Math.min(MAX_HOUR_HEIGHT, state.hourHeight + ZOOM_STEP),
        })),

      zoomOut: () =>
        set((state) => ({
          hourHeight: Math.max(MIN_HOUR_HEIGHT, state.hourHeight - ZOOM_STEP),
        })),

      setHourHeight: (height) =>
        set({
          hourHeight: Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, height)),
        }),

      setShowWeekends: (show) => set({ showWeekends: show }),
      setWidenCurrentDay: (widen) => set({ widenCurrentDay: widen }),
      setDimPastEvents: (dim) => set({ dimPastEvents: dim }),
      setShowCompletedTasks: (show) => set({ showCompletedTasks: show }),
      setShowDeclinedEvents: (show) => set({ showDeclinedEvents: show }),
      setMergeDuplicateEvents: (merge) => set({ mergeDuplicateEvents: merge }),

      startDrag: (drag) => set({ drag: { ...drag, isDragging: true } }),

      updateDrag: (time, date) =>
        set((state) => ({
          drag: { ...state.drag, dragCurrentTime: time, dragCurrentDate: date },
        })),

      endDrag: () => set({ drag: { ...initialDragState } }),
    }),
    {
      name: 'poolendar-calendar-store',
      partialize: (state) => ({
        view: state.view,
        customDays: state.customDays,
        hourHeight: state.hourHeight,
        showWeekends: state.showWeekends,
        widenCurrentDay: state.widenCurrentDay,
        dimPastEvents: state.dimPastEvents,
        showCompletedTasks: state.showCompletedTasks,
        showDeclinedEvents: state.showDeclinedEvents,
        mergeDuplicateEvents: state.mergeDuplicateEvents,
      }),
    }
  )
)
