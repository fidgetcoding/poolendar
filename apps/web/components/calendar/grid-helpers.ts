import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  getDay,
} from 'date-fns'
import type { CalendarEvent } from '@poolendar/types'
import type { CalendarItemData } from './calendar-types'

export type GridView = 'day' | 'week' | 'month' | '2weeks' | 'custom'

/**
 * Routine grid items use a composite id `${routineId}-${yyyy-MM-dd}` so each
 * day's occurrence is distinct. Split it back into the base routine id + date.
 */
export function parseRoutineItemId(id: string): {
  routineId: string
  date: string | null
} {
  const match = /^(.*)-(\d{4}-\d{2}-\d{2})$/.exec(id)
  if (match) return { routineId: match[1]!, date: match[2]! }
  return { routineId: id, date: null }
}

/**
 * The instant an event visually "ends on". An event ending exactly at
 * midnight (00:00) belongs to the previous day, matching Google Calendar.
 */
function effectiveEnd(item: CalendarItemData): Date {
  const e = item.endTime
  const endsAtMidnight =
    e.getHours() === 0 &&
    e.getMinutes() === 0 &&
    e.getSeconds() === 0 &&
    e.getTime() > item.startTime.getTime()
  return endsAtMidnight ? new Date(e.getTime() - 1) : e
}

/** True when the item's start and (visual) end fall on different calendar days. */
export function isMultiDayItem(item: CalendarItemData): boolean {
  return (
    startOfDay(item.startTime).getTime() !==
    startOfDay(effectiveEnd(item)).getTime()
  )
}

/** Items that belong in the all-day row: explicit all-day OR multi-day (#15d). */
export function isAllDayRowItem(item: CalendarItemData): boolean {
  return !!item.isAllDay || isMultiDayItem(item)
}

/** True when a timed item overlaps the given day at all. */
export function itemOverlapsDay(item: CalendarItemData, day: Date): boolean {
  return item.startTime < endOfDay(day) && item.endTime > startOfDay(day)
}

/**
 * Clamp a timed item's start/end to a single day so cross-midnight events
 * position correctly per day instead of reusing the original-day hours (#8).
 * Returns the same object when no clamping is needed.
 */
export function clampItemToDay(
  item: CalendarItemData,
  day: Date
): CalendarItemData {
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  const start = item.startTime < dayStart ? dayStart : item.startTime
  const end = item.endTime > dayEnd ? dayEnd : item.endTime
  if (start === item.startTime && end === item.endTime) return item
  return { ...item, startTime: start, endTime: end }
}

/**
 * Collapse events with the same title and exact start/end that come from
 * different calendars into a single rendered block (#5 mergeDuplicateEvents).
 * Non-event items pass through untouched.
 */
export function mergeDuplicateEventItems(
  items: CalendarItemData[]
): CalendarItemData[] {
  const seen = new Set<string>()
  const out: CalendarItemData[] = []
  for (const item of items) {
    if (item.type !== 'event') {
      out.push(item)
      continue
    }
    const key = `${item.title}|${item.startTime.getTime()}|${item.endTime.getTime()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/**
 * True when the current user (identified by their connected-account emails)
 * has declined the event. With no self-email context, nothing is declined.
 */
export function isDeclinedEvent(
  event: CalendarEvent,
  selfEmails: string[]
): boolean {
  if (selfEmails.length === 0) return false
  const lower = selfEmails.map((e) => e.toLowerCase())
  return (event.attendees ?? []).some(
    (a) => lower.includes(a.email.toLowerCase()) && a.response_status === 'declined'
  )
}

/** Drop Saturday/Sunday from a day list (used when "Show weekends" is off). */
export function filterWeekends(days: Date[]): Date[] {
  return days.filter((d) => {
    const dow = getDay(d)
    return dow !== 0 && dow !== 6
  })
}

/**
 * The visible day columns for a view. Unlike the old grid, 2-weeks renders 14
 * columns and custom renders N (1–9) columns instead of collapsing to a week
 * (#4).
 */
export function getVisibleDays(
  currentDate: Date,
  view: GridView,
  customDays = 3
): Date[] {
  switch (view) {
    case 'day':
      return [currentDate]
    case 'week': {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      const we = endOfWeek(currentDate, { weekStartsOn: 0 })
      return eachDayOfInterval({ start: ws, end: we })
    }
    case '2weeks': {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 })
      return eachDayOfInterval({ start: ws, end: addDays(ws, 13) })
    }
    case 'custom': {
      const n = Math.max(1, Math.min(9, customDays))
      return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, n - 1) })
    }
    case 'month': {
      const ms = startOfMonth(currentDate)
      const me = endOfMonth(currentDate)
      const cs = startOfWeek(ms, { weekStartsOn: 0 })
      const ce = endOfWeek(me, { weekStartsOn: 0 })
      return eachDayOfInterval({ start: cs, end: ce })
    }
  }
}
