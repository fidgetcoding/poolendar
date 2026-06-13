import { describe, it, expect } from 'vitest'
import {
  createFrameSchema,
  updateFrameSchema,
  frameOverrideSchema,
  autoScheduleRunSchema,
  classifyTaskSchema,
  autoScheduleWeightsSchema,
} from '../frame'

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function validFrame() {
  return {
    name: 'Deep work',
    time_blocks: [{ day: 1, start: '09:00', end: '12:00' }],
  }
}

/* ------------------------------------------------------------------ */
/*  createFrameSchema                                                 */
/* ------------------------------------------------------------------ */

describe('createFrameSchema', () => {
  /* --- happy path --- */

  it('accepts minimal valid input', () => {
    const result = createFrameSchema.safeParse(validFrame())
    expect(result.success).toBe(true)
  })

  it('accepts full valid input with every optional field', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      description: 'No meetings, no Slack',
      color: '#ff5733',
      recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE',
      is_active: false,
      priority_rank: 5,
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for omitted optional fields', () => {
    const result = createFrameSchema.parse(validFrame())
    expect(result.color).toBe('#6366f1')
    expect(result.is_active).toBe(true)
    expect(result.priority_rank).toBe(0)
  })

  /* --- required fields --- */

  it('rejects missing name', () => {
    const result = createFrameSchema.safeParse({ time_blocks: validFrame().time_blocks })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('rejects empty name', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), name: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects missing time_blocks', () => {
    const result = createFrameSchema.safeParse({ name: 'Deep work' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['time_blocks'])
  })

  it('rejects empty time_blocks array', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), time_blocks: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['time_blocks'])
  })

  /* --- time_blocks day (0-6) --- */

  it('accepts day=0 (Sunday)', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 0, start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts day=6 (Saturday)', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 6, start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects day=-1', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: -1, start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['time_blocks', 0, 'day'])
  })

  it('rejects day=7', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 7, start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['time_blocks', 0, 'day'])
  })

  it('rejects fractional day', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 1.5, start: '09:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
  })

  /* --- time_blocks start/end (HH:MM) --- */

  it('rejects time block with seconds', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 1, start: '09:00:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects time block with single-digit hour', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 1, start: '9:00', end: '17:00' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects time block with non-numeric value', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [{ day: 1, start: 'nine', end: '17:00' }],
    })
    expect(result.success).toBe(false)
  })

  /* --- color --- */

  it('accepts valid hex color', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), color: '#aaBBcc' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid hex color (no hash)', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), color: 'ff5733' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['color'])
  })

  it('rejects 3-digit hex shorthand', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), color: '#abc' })
    expect(result.success).toBe(false)
  })

  it('rejects color name', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), color: 'red' })
    expect(result.success).toBe(false)
  })

  /* --- description --- */

  it('accepts null description', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), description: null })
    expect(result.success).toBe(true)
  })

  it('rejects description exceeding 500 characters', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), description: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  /* --- priority_rank --- */

  it('accepts zero priority_rank', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), priority_rank: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts positive priority_rank', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), priority_rank: 100 })
    expect(result.success).toBe(true)
  })

  it('rejects negative priority_rank', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), priority_rank: -1 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['priority_rank'])
  })

  it('rejects fractional priority_rank', () => {
    const result = createFrameSchema.safeParse({ ...validFrame(), priority_rank: 1.5 })
    expect(result.success).toBe(false)
  })

  /* --- multiple time blocks --- */

  it('accepts multiple time blocks', () => {
    const result = createFrameSchema.safeParse({
      ...validFrame(),
      time_blocks: [
        { day: 1, start: '09:00', end: '12:00' },
        { day: 1, start: '14:00', end: '17:00' },
        { day: 3, start: '09:00', end: '12:00' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/*  updateFrameSchema                                                 */
/* ------------------------------------------------------------------ */

describe('updateFrameSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateFrameSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with name only', () => {
    const result = updateFrameSchema.safeParse({ name: 'Shallow work' })
    expect(result.success).toBe(true)
  })

  it('still enforces color regex on partial update', () => {
    const result = updateFrameSchema.safeParse({ color: 'not-hex' })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  frameOverrideSchema                                               */
/* ------------------------------------------------------------------ */

describe('frameOverrideSchema', () => {
  it('accepts valid override', () => {
    const result = frameOverrideSchema.safeParse({ date: '2026-06-15', active: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing date', () => {
    const result = frameOverrideSchema.safeParse({ active: true })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['date'])
  })

  it('rejects missing active', () => {
    const result = frameOverrideSchema.safeParse({ date: '2026-06-15' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['active'])
  })

  it('rejects invalid date format (ISO datetime)', () => {
    const result = frameOverrideSchema.safeParse({ date: '2026-06-15T09:00:00Z', active: true })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format (US style)', () => {
    const result = frameOverrideSchema.safeParse({ date: '06/15/2026', active: true })
    expect(result.success).toBe(false)
  })

  it('accepts active=true', () => {
    const result = frameOverrideSchema.safeParse({ date: '2026-06-15', active: true })
    expect(result.success).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/*  autoScheduleRunSchema                                             */
/* ------------------------------------------------------------------ */

describe('autoScheduleRunSchema', () => {
  it('accepts empty object (defaults applied)', () => {
    const result = autoScheduleRunSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('applies defaults', () => {
    const result = autoScheduleRunSchema.parse({})
    expect(result.confirm).toBe(false)
    expect(result.window_days).toBe(7)
  })

  it('accepts confirm=true', () => {
    const result = autoScheduleRunSchema.safeParse({ confirm: true })
    expect(result.success).toBe(true)
  })

  it('accepts minimum window_days (1)', () => {
    const result = autoScheduleRunSchema.safeParse({ window_days: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts maximum window_days (30)', () => {
    const result = autoScheduleRunSchema.safeParse({ window_days: 30 })
    expect(result.success).toBe(true)
  })

  it('rejects window_days below minimum (0)', () => {
    const result = autoScheduleRunSchema.safeParse({ window_days: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['window_days'])
  })

  it('rejects window_days above maximum (31)', () => {
    const result = autoScheduleRunSchema.safeParse({ window_days: 31 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['window_days'])
  })

  it('rejects fractional window_days', () => {
    const result = autoScheduleRunSchema.safeParse({ window_days: 7.5 })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  classifyTaskSchema                                                */
/* ------------------------------------------------------------------ */

describe('classifyTaskSchema', () => {
  it('accepts valid uuid', () => {
    const result = classifyTaskSchema.safeParse({ task_id: UUID })
    expect(result.success).toBe(true)
  })

  it('rejects missing task_id', () => {
    const result = classifyTaskSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['task_id'])
  })

  it('rejects non-uuid task_id', () => {
    const result = classifyTaskSchema.safeParse({ task_id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  autoScheduleWeightsSchema                                         */
/* ------------------------------------------------------------------ */

describe('autoScheduleWeightsSchema', () => {
  it('accepts valid weights at boundaries', () => {
    const result = autoScheduleWeightsSchema.safeParse({
      urgency: 0,
      deadline: 0.5,
      tag_priority: 1,
      staleness: 0.3,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all zeros', () => {
    const result = autoScheduleWeightsSchema.safeParse({
      urgency: 0,
      deadline: 0,
      tag_priority: 0,
      staleness: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all ones', () => {
    const result = autoScheduleWeightsSchema.safeParse({
      urgency: 1,
      deadline: 1,
      tag_priority: 1,
      staleness: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects urgency above 1', () => {
    const result = autoScheduleWeightsSchema.safeParse({
      urgency: 1.1,
      deadline: 0.5,
      tag_priority: 0.5,
      staleness: 0.5,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['urgency'])
  })

  it('rejects negative deadline', () => {
    const result = autoScheduleWeightsSchema.safeParse({
      urgency: 0.5,
      deadline: -0.1,
      tag_priority: 0.5,
      staleness: 0.5,
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['deadline'])
  })

  it('rejects missing fields', () => {
    const result = autoScheduleWeightsSchema.safeParse({ urgency: 0.5 })
    expect(result.success).toBe(false)
  })
})
