import { describe, it, expect } from 'vitest'
import {
  escapeICSText,
  formatICSDate,
  foldICSLine,
  generateBookingICS,
} from '../ics'

describe('escapeICSText', () => {
  it('escapes backslash, semicolon, comma', () => {
    expect(escapeICSText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })

  it('escapes newlines to literal \\n', () => {
    expect(escapeICSText('line1\nline2')).toBe('line1\\nline2')
    expect(escapeICSText('line1\r\nline2')).toBe('line1\\nline2')
  })

  it('leaves plain text untouched', () => {
    expect(escapeICSText('Meeting with Nate')).toBe('Meeting with Nate')
  })
})

describe('formatICSDate', () => {
  it('formats as UTC basic form with Z suffix', () => {
    const d = new Date('2026-07-15T14:30:00Z')
    expect(formatICSDate(d)).toBe('20260715T143000Z')
  })

  it('converts a non-UTC instant to UTC', () => {
    // 2026-07-15T09:00:00-04:00 === 13:00:00Z
    const d = new Date('2026-07-15T09:00:00-04:00')
    expect(formatICSDate(d)).toBe('20260715T130000Z')
  })

  it('zero-pads single-digit components', () => {
    const d = new Date('2026-01-05T03:07:09Z')
    expect(formatICSDate(d)).toBe('20260105T030709Z')
  })
})

describe('foldICSLine', () => {
  it('leaves short lines unchanged', () => {
    expect(foldICSLine('SUMMARY:hi')).toBe('SUMMARY:hi')
  })

  it('folds lines longer than 75 octets with CRLF + space', () => {
    const long = 'DESCRIPTION:' + 'x'.repeat(100)
    const folded = foldICSLine(long)
    expect(folded).toContain('\r\n ')
    // Every physical line must be <= 75 octets.
    for (const physical of folded.split('\r\n')) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75)
    }
  })

  it('reconstructs the original when unfolded', () => {
    const long = 'DESCRIPTION:' + 'abcdefghij'.repeat(12)
    const folded = foldICSLine(long)
    const unfolded = folded.replace(/\r\n /g, '')
    expect(unfolded).toBe(long)
  })
})

describe('generateBookingICS', () => {
  const base = {
    uid: 'booking-123@poolendar.com',
    start: new Date('2026-07-15T13:00:00Z'),
    end: new Date('2026-07-15T13:30:00Z'),
    summary: 'LORECRAFT 30min with Alex',
    organizer: { email: 'host@poolendar.test', name: 'Nate Host' },
    attendee: { email: 'alex@example.com', name: 'Alex' },
    dtstamp: new Date('2026-07-14T10:00:00Z'),
  }

  it('produces a well-formed VCALENDAR with METHOD:REQUEST', () => {
    const ics = generateBookingICS(base)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('METHOD:REQUEST')
    expect(ics).toContain('VERSION:2.0')
  })

  it('uses CRLF line endings', () => {
    const ics = generateBookingICS(base)
    expect(ics.split('\r\n').length).toBeGreaterThan(10)
    // No bare LF outside of folded continuations.
    expect(ics.includes('\n')).toBe(true)
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it('emits organizer and attendee as mailto with CN', () => {
    // The ATTENDEE line exceeds 75 octets and is legitimately folded; unfold
    // (strip CRLF+space continuations) before matching the logical content.
    const unfolded = generateBookingICS(base).replace(/\r\n /g, '')
    expect(unfolded).toContain('ORGANIZER;CN=Nate Host:mailto:host@poolendar.test')
    expect(unfolded).toContain(
      'ATTENDEE;CN=Alex;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:alex@example.com'
    )
  })

  it('emits UTC DTSTART/DTEND/DTSTAMP', () => {
    const ics = generateBookingICS(base)
    expect(ics).toContain('DTSTART:20260715T130000Z')
    expect(ics).toContain('DTEND:20260715T133000Z')
    expect(ics).toContain('DTSTAMP:20260714T100000Z')
  })

  it('escapes special characters in summary/description', () => {
    const ics = generateBookingICS({
      ...base,
      summary: 'Chat; with, Nate',
      description: 'Notes:\nsecond line',
    })
    expect(ics).toContain('SUMMARY:Chat\\; with\\, Nate')
    expect(ics).toContain('DESCRIPTION:Notes:\\nsecond line')
  })

  it('supports CANCELLED status with METHOD:CANCEL', () => {
    const ics = generateBookingICS({ ...base, status: 'CANCELLED', sequence: 1 })
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('SEQUENCE:1')
  })

  it('defaults sequence to 0 and status to CONFIRMED', () => {
    const ics = generateBookingICS(base)
    expect(ics).toContain('SEQUENCE:0')
    expect(ics).toContain('STATUS:CONFIRMED')
  })
})
