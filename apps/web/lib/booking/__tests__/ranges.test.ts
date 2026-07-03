import { describe, it, expect } from 'vitest'
import {
  paintedToRanges,
  rangesToPainted,
  applyPaint,
  formatRangesAsText,
  cellKey,
  slotToTime,
  timeToSlot,
  type AvailabilityRange,
} from '../ranges'

describe('slot <-> time', () => {
  it('converts slot index to HH:MM', () => {
    expect(slotToTime(0)).toBe('00:00')
    expect(slotToTime(26)).toBe('13:00') // 26 * 30min = 13:00
    expect(slotToTime(27)).toBe('13:30')
    expect(slotToTime(48)).toBe('24:00')
  })
  it('converts HH:MM to slot index', () => {
    expect(timeToSlot('00:00')).toBe(0)
    expect(timeToSlot('13:00')).toBe(26)
    expect(timeToSlot('17:00')).toBe(34)
  })
})

describe('paintedToRanges — merge', () => {
  it('merges contiguous cells into one range with exclusive end', () => {
    // 13:00..17:00 = slots 26..33 (8 cells → ends at slot 34 = 17:00)
    const painted = new Set<string>()
    for (let s = 26; s < 34; s++) painted.add(cellKey('monday', s))
    expect(paintedToRanges(painted)).toEqual([
      { day: 'monday', start: '13:00', end: '17:00' },
    ])
  })

  it('splits non-contiguous cells into separate ranges', () => {
    const painted = new Set<string>([
      cellKey('monday', 18), // 09:00
      cellKey('monday', 19), // 09:30 → 09:00-10:00
      cellKey('monday', 26), // 13:00
      cellKey('monday', 27), // 13:30 → 13:00-14:00
    ])
    expect(paintedToRanges(painted)).toEqual([
      { day: 'monday', start: '09:00', end: '10:00' },
      { day: 'monday', start: '13:00', end: '14:00' },
    ])
  })

  it('orders output by day then start', () => {
    const painted = new Set<string>([
      cellKey('wednesday', 20),
      cellKey('monday', 20),
    ])
    const ranges = paintedToRanges(painted)
    expect(ranges.map((r) => r.day)).toEqual(['monday', 'wednesday'])
  })

  it('ignores malformed / out-of-range keys', () => {
    const painted = new Set<string>([
      'notaday:5',
      'monday:999',
      'monday:-1',
      cellKey('monday', 20),
    ])
    expect(paintedToRanges(painted)).toEqual([
      { day: 'monday', start: '10:00', end: '10:30' },
    ])
  })
})

describe('rangesToPainted — round trip', () => {
  it('is the inverse of paintedToRanges', () => {
    const ranges: AvailabilityRange[] = [
      { day: 'monday', start: '13:00', end: '17:00' },
      { day: 'friday', start: '09:00', end: '12:00' },
    ]
    const painted = rangesToPainted(ranges)
    expect(paintedToRanges(painted)).toEqual(ranges)
  })

  it('expands a range into the right number of cells', () => {
    const painted = rangesToPainted([{ day: 'monday', start: '13:00', end: '15:00' }])
    expect(painted.size).toBe(4) // 2 hours / 30min
    expect(painted.has(cellKey('monday', 26))).toBe(true) // 13:00
    expect(painted.has(cellKey('monday', 29))).toBe(true) // 14:30
    expect(painted.has(cellKey('monday', 30))).toBe(false) // 15:00 is exclusive
  })
})

describe('applyPaint', () => {
  it('paints an inclusive slot range in either drag direction', () => {
    const a = applyPaint(new Set(), 'monday', 26, 29, 'add')
    const b = applyPaint(new Set(), 'monday', 29, 26, 'add')
    expect(a).toEqual(b)
    expect(a.size).toBe(4)
  })

  it('erases cells', () => {
    let painted = applyPaint(new Set(), 'monday', 26, 33, 'add')
    painted = applyPaint(painted, 'monday', 28, 29, 'erase')
    expect(paintedToRanges(painted)).toEqual([
      { day: 'monday', start: '13:00', end: '14:00' }, // 26-27
      { day: 'monday', start: '15:00', end: '17:00' }, // 30-33
    ])
  })

  it('clamps to grid bounds and does not mutate the input set', () => {
    const input = new Set<string>()
    const out = applyPaint(input, 'monday', -5, 100, 'add')
    expect(input.size).toBe(0)
    expect(out.size).toBe(48)
  })
})

describe('formatRangesAsText', () => {
  it('formats a range as "Every Mon, 1:00 PM - 5:00 PM"', () => {
    expect(
      formatRangesAsText([{ day: 'monday', start: '13:00', end: '17:00' }])
    ).toEqual(['Every Mon, 1:00 PM - 5:00 PM'])
  })

  it('handles half hours and morning times', () => {
    expect(
      formatRangesAsText([{ day: 'friday', start: '09:30', end: '12:00' }])
    ).toEqual(['Every Fri, 9:30 AM - 12:00 PM'])
  })

  it('renders midnight and noon correctly', () => {
    expect(
      formatRangesAsText([{ day: 'sunday', start: '00:00', end: '12:00' }])
    ).toEqual(['Every Sun, 12:00 AM - 12:00 PM'])
  })
})
