import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isToday as isTodayFn,
  isSameDay as isSameDayFn,
  addMinutes,
  differenceInMinutes,
  parseISO,
  setHours,
  setMinutes,
  getDay,
  getWeek,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? parseISO(d) : d
}

// ---------------------------------------------------------------------------
// Week / Month grids
// ---------------------------------------------------------------------------

/**
 * Get all days in the week containing `date`.
 * @param weekStartsOn 0 = Sunday, 1 = Monday
 */
export function getWeekDays(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(date, { weekStartsOn })
  const end = endOfWeek(date, { weekStartsOn })
  return eachDayOfInterval({ start, end })
}

/**
 * Get all days to display in a month grid.
 * Includes padding days from the previous / next month to fill 6 rows of 7.
 */
export function getMonthDays(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)

  // Start from the beginning of the week that contains the first of the month
  const gridStart = startOfWeek(monthStart, { weekStartsOn })

  // End at the end of the week that contains the last of the month,
  // then pad to exactly 42 cells (6 rows x 7 days)
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Pad to 42 days if fewer (handles months that fit in 5 rows)
  while (days.length < 42) {
    const lastDay = days[days.length - 1]
    days.push(addMinutes(endOfDay(lastDay), 1)) // next day start
  }

  return days.slice(0, 42)
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/**
 * Format time — e.g. "2:30 PM" (12h) or "14:30" (24h).
 */
export function formatTime(date: Date | string, format24h = false): string {
  const d = toDate(date)
  return format(d, format24h ? 'HH:mm' : 'h:mm a')
}

/**
 * Format a date range.
 * If same day: "2:30 PM - 3:00 PM"
 * If different days: "Jun 12 - Jun 15"
 */
export function formatDateRange(
  start: Date | string,
  end: Date | string,
  format24h = false
): string {
  const s = toDate(start)
  const e = toDate(end)

  if (isSameDayFn(s, e)) {
    return `${formatTime(s, format24h)} - ${formatTime(e, format24h)}`
  }

  return `${format(s, 'MMM d')} - ${format(e, 'MMM d')}`
}

// ---------------------------------------------------------------------------
// Date checks
// ---------------------------------------------------------------------------

/** Check if a date is today. */
export function isToday(date: Date | string): boolean {
  return isTodayFn(toDate(date))
}

/** Check if two dates are the same calendar day. */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  return isSameDayFn(toDate(a), toDate(b))
}

// ---------------------------------------------------------------------------
// Time grid helpers
// ---------------------------------------------------------------------------

/**
 * Get an array of hour numbers for the time grid.
 * Defaults to the full 0-23 range.
 */
export function getHoursInDay(startHour = 0, endHour = 24): number[] {
  const hours: number[] = []
  const clamped = Math.min(endHour, 24)
  for (let h = startHour; h < clamped; h++) {
    hours.push(h)
  }
  return hours
}

/** Get ISO week number for a date. */
export function getWeekNumber(date: Date | string): number {
  return getWeek(toDate(date))
}

/** Convert a Date to minutes since midnight. */
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Convert minutes since midnight to a time string.
 * e.g., 810 -> "1:30 PM" or "13:30"
 */
export function minutesToTime(minutes: number, format24h = false): string {
  const clamped = Math.max(0, Math.min(minutes, 1439))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60

  if (format24h) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * Snap minutes to the nearest resolution increment.
 * e.g., snapToResolution(17, 15) -> 15
 */
export function snapToResolution(minutes: number, resolution: number): number {
  if (resolution <= 0) return minutes
  return Math.round(minutes / resolution) * resolution
}

// ---------------------------------------------------------------------------
// Duration parsing / formatting
// ---------------------------------------------------------------------------

/**
 * Parse a time estimate string like "60m", "2h", "1h30m" to minutes.
 * Returns null if the string doesn't match.
 */
export function parseTimeEstimate(estimate: string): number | null {
  const trimmed = estimate.trim().toLowerCase()
  if (!trimmed) return null

  // Try "Xh Ym" or "XhYm" pattern
  const combined = trimmed.match(
    /^(\d+)\s*h\s*(?:(\d+)\s*m)?$/
  )
  if (combined && combined[1]) {
    const hours = parseInt(combined[1], 10)
    const mins = combined[2] ? parseInt(combined[2], 10) : 0
    return hours * 60 + mins
  }

  // Try standalone minutes "Xm"
  const minsOnly = trimmed.match(/^(\d+)\s*m$/)
  if (minsOnly && minsOnly[1]) {
    return parseInt(minsOnly[1], 10)
  }

  // Try standalone hours "Xh"
  const hoursOnly = trimmed.match(/^(\d+)\s*h$/)
  if (hoursOnly && hoursOnly[1]) {
    return parseInt(hoursOnly[1], 10) * 60
  }

  // Try bare number (treated as minutes)
  const bare = trimmed.match(/^(\d+)$/)
  if (bare && bare[1]) {
    return parseInt(bare[1], 10)
  }

  return null
}

/**
 * Format minutes as a readable duration.
 * e.g., 90 -> "1h 30m", 60 -> "1h", 45 -> "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'

  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
