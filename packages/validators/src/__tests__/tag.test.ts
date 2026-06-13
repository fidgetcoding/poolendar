import { describe, it, expect } from 'vitest'
import { createTagSchema, updateTagSchema } from '../tag'

/* ------------------------------------------------------------------ */
/*  createTagSchema                                                   */
/* ------------------------------------------------------------------ */

describe('createTagSchema', () => {
  /* --- happy path --- */

  it('accepts valid tag with name and color', () => {
    const result = createTagSchema.safeParse({ name: 'urgent', color: '#ff0000' })
    expect(result.success).toBe(true)
  })

  it('accepts tag with optional prefix', () => {
    const result = createTagSchema.safeParse({ name: 'work', color: '#00ff00', prefix: 'W' })
    expect(result.success).toBe(true)
  })

  it('accepts null prefix', () => {
    const result = createTagSchema.safeParse({ name: 'personal', color: '#0000ff', prefix: null })
    expect(result.success).toBe(true)
  })

  /* --- required fields --- */

  it('rejects missing name', () => {
    const result = createTagSchema.safeParse({ color: '#ff0000' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('rejects missing color', () => {
    const result = createTagSchema.safeParse({ name: 'urgent' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['color'])
  })

  /* --- name validation --- */

  it('rejects empty name', () => {
    const result = createTagSchema.safeParse({ name: '', color: '#ff0000' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('rejects name exceeding 100 characters', () => {
    const result = createTagSchema.safeParse({ name: 'x'.repeat(101), color: '#ff0000' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['name'])
  })

  it('accepts name at max length (100)', () => {
    const result = createTagSchema.safeParse({ name: 'x'.repeat(100), color: '#ff0000' })
    expect(result.success).toBe(true)
  })

  /* --- color validation --- */

  it('accepts valid 6-digit hex color', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: '#aaBBcc' })
    expect(result.success).toBe(true)
  })

  it('rejects hex without hash', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: 'ff0000' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['color'])
  })

  it('rejects 3-digit hex shorthand', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: '#f00' })
    expect(result.success).toBe(false)
  })

  it('rejects 8-digit hex (alpha)', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: '#ff0000ff' })
    expect(result.success).toBe(false)
  })

  it('rejects color name', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: 'red' })
    expect(result.success).toBe(false)
  })

  it('rejects rgb notation', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: 'rgb(255,0,0)' })
    expect(result.success).toBe(false)
  })

  /* --- prefix validation --- */

  it('accepts prefix up to 10 characters', () => {
    const result = createTagSchema.safeParse({ name: 'tag', color: '#ff0000', prefix: 'ABCDEFGHIJ' })
    expect(result.success).toBe(true)
  })

  it('rejects prefix exceeding 10 characters', () => {
    const result = createTagSchema.safeParse({
      name: 'tag',
      color: '#ff0000',
      prefix: 'x'.repeat(11),
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['prefix'])
  })
})

/* ------------------------------------------------------------------ */
/*  updateTagSchema                                                   */
/* ------------------------------------------------------------------ */

describe('updateTagSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateTagSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with name only', () => {
    const result = updateTagSchema.safeParse({ name: 'renamed' })
    expect(result.success).toBe(true)
  })

  it('accepts partial update with color only', () => {
    const result = updateTagSchema.safeParse({ color: '#00ff00' })
    expect(result.success).toBe(true)
  })

  it('still enforces color regex on partial update', () => {
    const result = updateTagSchema.safeParse({ color: 'bad' })
    expect(result.success).toBe(false)
  })

  it('still enforces name constraints on partial update', () => {
    const result = updateTagSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})
