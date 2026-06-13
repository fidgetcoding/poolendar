import { describe, it, expect } from 'vitest'
import { convertSchema } from '../convert'

/* ------------------------------------------------------------------ */
/*  helpers                                                           */
/* ------------------------------------------------------------------ */

const UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

/* ------------------------------------------------------------------ */
/*  convertSchema                                                     */
/* ------------------------------------------------------------------ */

describe('convertSchema', () => {
  /* --- happy path --- */

  it('accepts valid event-to-task conversion', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
      target_type: 'task',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid task-to-routine conversion', () => {
    const result = convertSchema.safeParse({
      source_type: 'task',
      source_id: UUID,
      target_type: 'routine',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid routine-to-event conversion', () => {
    const result = convertSchema.safeParse({
      source_type: 'routine',
      source_id: UUID,
      target_type: 'event',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid cross-type combinations', () => {
    const types = ['event', 'task', 'routine'] as const
    for (const source_type of types) {
      for (const target_type of types) {
        if (source_type === target_type) continue
        const result = convertSchema.safeParse({ source_type, source_id: UUID, target_type })
        expect(result.success).toBe(true)
      }
    }
  })

  it('accepts optional calendar_id', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
      target_type: 'task',
      calendar_id: UUID,
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional repeat_pattern', () => {
    const result = convertSchema.safeParse({
      source_type: 'task',
      source_id: UUID,
      target_type: 'routine',
      repeat_pattern: 'RRULE:FREQ=DAILY',
    })
    expect(result.success).toBe(true)
  })

  /* --- same type rejection (refine) --- */

  it('rejects same source_type and target_type (event)', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
      target_type: 'event',
    })
    expect(result.success).toBe(false)
    // refine errors don't have a path on a specific field
    expect(result.error?.issues[0]?.message).toBe(
      'source_type and target_type must be different',
    )
  })

  it('rejects same source_type and target_type (task)', () => {
    const result = convertSchema.safeParse({
      source_type: 'task',
      source_id: UUID,
      target_type: 'task',
    })
    expect(result.success).toBe(false)
  })

  it('rejects same source_type and target_type (routine)', () => {
    const result = convertSchema.safeParse({
      source_type: 'routine',
      source_id: UUID,
      target_type: 'routine',
    })
    expect(result.success).toBe(false)
  })

  /* --- required fields --- */

  it('rejects missing source_type', () => {
    const result = convertSchema.safeParse({
      source_id: UUID,
      target_type: 'task',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing source_id', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      target_type: 'task',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing target_type', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
    })
    expect(result.success).toBe(false)
  })

  /* --- type validation --- */

  it('rejects invalid source_type', () => {
    const result = convertSchema.safeParse({
      source_type: 'booking',
      source_id: UUID,
      target_type: 'task',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid target_type', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
      target_type: 'booking',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid source_id', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: 'not-a-uuid',
      target_type: 'task',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid calendar_id when provided', () => {
    const result = convertSchema.safeParse({
      source_type: 'event',
      source_id: UUID,
      target_type: 'task',
      calendar_id: 'bad-id',
    })
    expect(result.success).toBe(false)
  })
})
