import { describe, it, expect } from 'vitest'
import { createBookingLinkSchema, updateBookingLinkSchema, bookSlotSchema } from '../booking'

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function validBookingLink() {
  return {
    slug: 'intro-call',
    name: '30-min Intro',
    duration_minutes: 30,
    availability: [
      { day: 'monday', start: '09:00', end: '17:00' },
    ],
  }
}

/* ------------------------------------------------------------------ */
/*  createBookingLinkSchema                                           */
/* ------------------------------------------------------------------ */

describe('createBookingLinkSchema', () => {
  /* --- happy path --- */

  it('accepts minimal valid input', () => {
    const result = createBookingLinkSchema.safeParse(validBookingLink())
    expect(result.success).toBe(true)
  })

  it('accepts full valid input with every optional field', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      timezone: 'Europe/London',
      google_account_id: UUID,
      conferencing: false,
      location: 'Office',
      notes: 'Bring resume',
      is_public: false,
      requires_approval: true,
      buffer_minutes: 15,
      minimum_notice_hours: 24,
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for omitted optional fields', () => {
    const result = createBookingLinkSchema.parse(validBookingLink())
    expect(result.timezone).toBe('America/New_York')
    expect(result.conferencing).toBe(true)
    expect(result.is_public).toBe(true)
    expect(result.requires_approval).toBe(false)
    expect(result.buffer_minutes).toBe(0)
    expect(result.minimum_notice_hours).toBe(0)
  })

  /* --- required fields --- */

  it('rejects missing slug', () => {
    const { slug: _, ...rest } = validBookingLink()
    const result = createBookingLinkSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['slug'])
  })

  it('rejects missing name', () => {
    const { name: _, ...rest } = validBookingLink()
    const result = createBookingLinkSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('rejects missing duration_minutes', () => {
    const { duration_minutes: _, ...rest } = validBookingLink()
    const result = createBookingLinkSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['duration_minutes'])
  })

  it('rejects missing availability', () => {
    const { availability: _, ...rest } = validBookingLink()
    const result = createBookingLinkSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['availability'])
  })

  /* --- slug validation --- */

  it('rejects empty slug', () => {
    const result = createBookingLinkSchema.safeParse({ ...validBookingLink(), slug: '' })
    expect(result.success).toBe(false)
  })

  it('rejects slug exceeding 100 characters', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      slug: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with uppercase letters', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      slug: 'Intro-Call',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['slug'])
  })

  it('rejects slug with spaces', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      slug: 'intro call',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with underscores', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      slug: 'intro_call',
    })
    expect(result.success).toBe(false)
  })

  it('accepts slug with digits and hyphens', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      slug: 'intro-call-30min',
    })
    expect(result.success).toBe(true)
  })

  /* --- name validation --- */

  it('rejects empty name', () => {
    const result = createBookingLinkSchema.safeParse({ ...validBookingLink(), name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 200 characters', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      name: 'x'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  /* --- duration_minutes --- */

  it('accepts positive integer duration', () => {
    const result = createBookingLinkSchema.safeParse({ ...validBookingLink(), duration_minutes: 60 })
    expect(result.success).toBe(true)
  })

  it('rejects zero duration', () => {
    const result = createBookingLinkSchema.safeParse({ ...validBookingLink(), duration_minutes: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['duration_minutes'])
  })

  it('rejects negative duration', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      duration_minutes: -30,
    })
    expect(result.success).toBe(false)
  })

  it('rejects fractional duration', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      duration_minutes: 30.5,
    })
    expect(result.success).toBe(false)
  })

  /* --- availability --- */

  it('rejects empty availability array', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability: [],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['availability'])
  })

  it('enforces availability max of 28', () => {
    const availability = Array.from({ length: 29 }, () => ({
      day: 'monday' as const,
      start: '09:00',
      end: '17:00',
    }))
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['availability'])
  })

  it('accepts exactly 28 availability slots', () => {
    const availability = Array.from({ length: 28 }, () => ({
      day: 'monday' as const,
      start: '09:00',
      end: '17:00',
    }))
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid day in availability', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability: [{ day: 'funday', start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['availability', 0, 'day'])
  })

  it('accepts all valid day names', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    for (const day of days) {
      const result = createBookingLinkSchema.safeParse({
        ...validBookingLink(),
        availability: [{ day, start: '09:00', end: '17:00' }],
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid time format in availability start', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability: [{ day: 'monday', start: '9am', end: '17:00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format in availability end', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      availability: [{ day: 'monday', start: '09:00', end: '5pm' }],
    })
    expect(result.success).toBe(false)
  })

  /* --- buffer_minutes --- */

  it('accepts zero buffer_minutes', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      buffer_minutes: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative buffer_minutes', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      buffer_minutes: -5,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['buffer_minutes'])
  })

  it('rejects fractional buffer_minutes', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      buffer_minutes: 10.5,
    })
    expect(result.success).toBe(false)
  })

  /* --- minimum_notice_hours --- */

  it('accepts zero minimum_notice_hours', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      minimum_notice_hours: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative minimum_notice_hours', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      minimum_notice_hours: -1,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['minimum_notice_hours'])
  })

  /* --- notes --- */

  it('accepts null notes', () => {
    const result = createBookingLinkSchema.safeParse({ ...validBookingLink(), notes: null })
    expect(result.success).toBe(true)
  })

  it('rejects notes exceeding 5000 characters', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      notes: 'n'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  /* --- google_account_id --- */

  it('accepts null google_account_id', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      google_account_id: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid google_account_id', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      google_account_id: 'not-uuid',
    })
    expect(result.success).toBe(false)
  })

  /* --- location --- */

  it('rejects location exceeding 500 characters', () => {
    const result = createBookingLinkSchema.safeParse({
      ...validBookingLink(),
      location: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  updateBookingLinkSchema                                           */
/* ------------------------------------------------------------------ */

describe('updateBookingLinkSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateBookingLinkSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with name only', () => {
    const result = updateBookingLinkSchema.safeParse({ name: 'Quick chat' })
    expect(result.success).toBe(true)
  })

  it('still enforces slug regex on partial update', () => {
    const result = updateBookingLinkSchema.safeParse({ slug: 'INVALID SLUG' })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  bookSlotSchema                                                    */
/* ------------------------------------------------------------------ */

describe('bookSlotSchema', () => {
  it('accepts valid booking', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane Doe',
      booker_email: 'jane@example.com',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts booking with optional notes', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane Doe',
      booker_email: 'jane@example.com',
      booker_notes: 'Looking forward to it',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null booker_notes', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane Doe',
      booker_email: 'jane@example.com',
      booker_notes: null,
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing booker_name', () => {
    const result = bookSlotSchema.safeParse({
      booker_email: 'jane@example.com',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['booker_name'])
  })

  it('rejects empty booker_name', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: '',
      booker_email: 'jane@example.com',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects booker_name exceeding 200 characters', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'x'.repeat(201),
      booker_email: 'jane@example.com',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing booker_email', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['booker_email'])
  })

  it('rejects invalid booker_email', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane',
      booker_email: 'not-an-email',
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['booker_email'])
  })

  it('rejects missing start_time', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane',
      booker_email: 'jane@example.com',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['start_time'])
  })

  it('rejects non-datetime start_time', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane',
      booker_email: 'jane@example.com',
      start_time: '2026-06-20',
    })
    expect(result.success).toBe(false)
  })

  it('rejects booker_notes exceeding 2000 characters', () => {
    const result = bookSlotSchema.safeParse({
      booker_name: 'Jane',
      booker_email: 'jane@example.com',
      booker_notes: 'x'.repeat(2001),
      start_time: '2026-06-20T10:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})
