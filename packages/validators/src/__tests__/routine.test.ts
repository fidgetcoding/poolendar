import { describe, it, expect } from 'vitest'
import { createRoutineSchema, updateRoutineSchema } from '../routine'

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

function validRoutine() {
  return {
    title: 'Morning run',
    start_time: '06:30',
    end_time: '07:30',
    recurrence_rule: 'RRULE:FREQ=DAILY',
  }
}

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/* ------------------------------------------------------------------ */
/*  createRoutineSchema                                               */
/* ------------------------------------------------------------------ */

describe('createRoutineSchema', () => {
  /* --- happy path --- */

  it('accepts minimal valid input', () => {
    const result = createRoutineSchema.safeParse(validRoutine())
    expect(result.success).toBe(true)
  })

  it('accepts full valid input with every optional field', () => {
    const result = createRoutineSchema.safeParse({
      ...validRoutine(),
      notes: 'Stretch beforehand',
      calendar_id: UUID,
      timezone: 'Europe/Berlin',
      location: 'Park trail',
      visibility: 'free',
      privacy: 'public',
      reminders: [{ minutes_before: 10 }],
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for omitted optional fields', () => {
    const result = createRoutineSchema.parse(validRoutine())
    expect(result.timezone).toBe('America/New_York')
    expect(result.visibility).toBe('busy')
    expect(result.privacy).toBe('private')
    expect(result.reminders).toEqual([])
  })

  /* --- required fields --- */

  it('rejects missing title', () => {
    const { title: _, ...rest } = validRoutine()
    const result = createRoutineSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['title'])
  })

  it('rejects empty title', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title exceeding 500 characters', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), title: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('rejects missing start_time', () => {
    const { start_time: _, ...rest } = validRoutine()
    const result = createRoutineSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['start_time'])
  })

  it('rejects missing end_time', () => {
    const { end_time: _, ...rest } = validRoutine()
    const result = createRoutineSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['end_time'])
  })

  it('rejects missing recurrence_rule', () => {
    const { recurrence_rule: _, ...rest } = validRoutine()
    const result = createRoutineSchema.safeParse(rest)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['recurrence_rule'])
  })

  it('rejects empty recurrence_rule', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), recurrence_rule: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['recurrence_rule'])
  })

  /* --- time format (HH:MM) --- */

  it('accepts valid HH:MM times', () => {
    const result = createRoutineSchema.safeParse({
      ...validRoutine(),
      start_time: '00:00',
      end_time: '23:59',
    })
    expect(result.success).toBe(true)
  })

  it('rejects start_time with seconds (HH:MM:SS)', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), start_time: '06:30:00' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['start_time'])
  })

  it('rejects single-digit hour format', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), start_time: '6:30' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['start_time'])
  })

  it('rejects end_time with invalid format', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), end_time: '7pm' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['end_time'])
  })

  it('rejects ISO datetime for start_time', () => {
    const result = createRoutineSchema.safeParse({
      ...validRoutine(),
      start_time: '2026-06-15T06:30:00Z',
    })
    expect(result.success).toBe(false)
  })

  /* --- notes --- */

  it('accepts null notes', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), notes: null })
    expect(result.success).toBe(true)
  })

  it('rejects notes exceeding 10000 characters', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), notes: 'n'.repeat(10001) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['notes'])
  })

  /* --- calendar_id --- */

  it('accepts null calendar_id', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), calendar_id: null })
    expect(result.success).toBe(true)
  })

  it('rejects non-uuid calendar_id', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), calendar_id: 'bad' })
    expect(result.success).toBe(false)
  })

  /* --- enums --- */

  it('rejects invalid visibility', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), visibility: 'tentative' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid privacy', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), privacy: 'secret' })
    expect(result.success).toBe(false)
  })

  /* --- location --- */

  it('rejects location exceeding 500 characters', () => {
    const result = createRoutineSchema.safeParse({ ...validRoutine(), location: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  /* --- reminders --- */

  it('enforces reminders max of 20', () => {
    const reminders = Array.from({ length: 21 }, () => ({ minutes_before: 5 }))
    const result = createRoutineSchema.safeParse({ ...validRoutine(), reminders })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['reminders'])
  })

  it('rejects reminder with non-positive minutes', () => {
    const result = createRoutineSchema.safeParse({
      ...validRoutine(),
      reminders: [{ minutes_before: 0 }],
    })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  updateRoutineSchema                                               */
/* ------------------------------------------------------------------ */

describe('updateRoutineSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateRoutineSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with title only', () => {
    const result = updateRoutineSchema.safeParse({ title: 'Evening run' })
    expect(result.success).toBe(true)
  })

  it('still enforces time format on partial update', () => {
    const result = updateRoutineSchema.safeParse({ start_time: '6:30' })
    expect(result.success).toBe(false)
  })

  it('still enforces title constraints on partial update', () => {
    const result = updateRoutineSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })
})
