// Pure paint/merge/split logic for the drag-to-paint weekly availability editor
// (spec #54). The grid is 7 days × 30-minute cells; a "painted" set of cells is
// the single source of truth, and this module converts between that cell set and
// the stored `booking_links.availability` shape ([{day, start, end}]). Kept pure
// so the (potentially large) editor component stays under 500 lines and the
// range math is unit-tested independently of React.

export const SLOT_MINUTES = 30
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES // 48

export type Day =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const DAYS: Day[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const DAY_LABELS: Record<Day, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

export interface AvailabilityRange {
  day: Day
  start: string // "HH:MM"
  end: string // "HH:MM"
}

/** Stable key for a single (day, slot) cell. */
export function cellKey(day: Day, slot: number): string {
  return `${day}:${slot}`
}

export function slotToTime(slot: number): string {
  const minutes = slot * SLOT_MINUTES
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function timeToSlot(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return Math.round(((h ?? 0) * 60 + (m ?? 0)) / SLOT_MINUTES)
}

/**
 * Collapse a painted cell set into merged ranges, one or more per day. Contiguous
 * slots merge; a gap splits into separate ranges. Output is sorted by day order
 * then start time.
 */
export function paintedToRanges(painted: Set<string>): AvailabilityRange[] {
  const byDay = new Map<Day, number[]>()
  for (const key of painted) {
    const [day, slotStr] = key.split(':') as [Day, string]
    if (!DAYS.includes(day)) continue
    const slot = Number(slotStr)
    if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS_PER_DAY) continue
    const arr = byDay.get(day) ?? []
    arr.push(slot)
    byDay.set(day, arr)
  }

  const ranges: AvailabilityRange[] = []
  for (const day of DAYS) {
    const slots = (byDay.get(day) ?? []).sort((a, b) => a - b)
    let i = 0
    while (i < slots.length) {
      const startSlot = slots[i]!
      let endSlot = startSlot
      while (i + 1 < slots.length && slots[i + 1] === endSlot + 1) {
        endSlot = slots[i + 1]!
        i++
      }
      ranges.push({
        day,
        start: slotToTime(startSlot),
        end: slotToTime(endSlot + 1), // range end is exclusive of the last cell
      })
      i++
    }
  }
  return ranges
}

/** Expand stored ranges back into a painted cell set (to seed the editor). */
export function rangesToPainted(ranges: AvailabilityRange[]): Set<string> {
  const painted = new Set<string>()
  for (const r of ranges) {
    if (!DAYS.includes(r.day)) continue
    const startSlot = timeToSlot(r.start)
    const endSlot = timeToSlot(r.end)
    for (let s = startSlot; s < endSlot; s++) {
      if (s >= 0 && s < SLOTS_PER_DAY) painted.add(cellKey(r.day, s))
    }
  }
  return painted
}

/**
 * Apply a drag from `fromSlot` to `toSlot` (inclusive, either direction) on one
 * day, either painting (add) or erasing. Returns a NEW set (immutable update).
 */
export function applyPaint(
  painted: Set<string>,
  day: Day,
  fromSlot: number,
  toSlot: number,
  mode: 'add' | 'erase'
): Set<string> {
  const next = new Set(painted)
  const lo = Math.max(0, Math.min(fromSlot, toSlot))
  const hi = Math.min(SLOTS_PER_DAY - 1, Math.max(fromSlot, toSlot))
  for (let s = lo; s <= hi; s++) {
    const key = cellKey(day, s)
    if (mode === 'add') next.add(key)
    else next.delete(key)
  }
  return next
}

function to12h(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const hour = h ?? 0
  const min = m ?? 0
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return min === 0 ? `${h12}:00 ${period}` : `${h12}:${String(min).padStart(2, '0')} ${period}`
}

/** Human-readable list, e.g. "Every Mon, 1:00 PM - 5:00 PM". */
export function formatRangesAsText(ranges: AvailabilityRange[]): string[] {
  return ranges.map(
    (r) => `Every ${DAY_LABELS[r.day]}, ${to12h(r.start)} - ${to12h(r.end)}`
  )
}
