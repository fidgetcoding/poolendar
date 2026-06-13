import { describe, it, expect } from 'vitest'
import { searchSchema } from '../search'

/* ------------------------------------------------------------------ */
/*  searchSchema                                                      */
/* ------------------------------------------------------------------ */

describe('searchSchema', () => {
  /* --- happy path --- */

  it('accepts minimal valid input (query only)', () => {
    const result = searchSchema.safeParse({ q: 'standup' })
    expect(result.success).toBe(true)
  })

  it('accepts full valid input with every optional field', () => {
    const result = searchSchema.safeParse({
      q: 'meeting',
      types: ['event', 'task'],
      limit: 10,
      cursor: 'eyJpZCI6MTIzfQ==',
    })
    expect(result.success).toBe(true)
  })

  it('applies default limit', () => {
    const result = searchSchema.parse({ q: 'test' })
    expect(result.limit).toBe(20)
  })

  /* --- q (query) --- */

  it('rejects missing q', () => {
    const result = searchSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['q'])
  })

  it('rejects empty q', () => {
    const result = searchSchema.safeParse({ q: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['q'])
  })

  it('rejects q exceeding 200 characters', () => {
    const result = searchSchema.safeParse({ q: 'x'.repeat(201) })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['q'])
  })

  it('accepts q at max length (200)', () => {
    const result = searchSchema.safeParse({ q: 'x'.repeat(200) })
    expect(result.success).toBe(true)
  })

  /* --- types --- */

  it('accepts all valid type values', () => {
    const result = searchSchema.safeParse({
      q: 'test',
      types: ['event', 'task', 'routine', 'booking_link'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts single type', () => {
    const result = searchSchema.safeParse({ q: 'test', types: ['event'] })
    expect(result.success).toBe(true)
  })

  it('accepts empty types array', () => {
    const result = searchSchema.safeParse({ q: 'test', types: [] })
    expect(result.success).toBe(true)
  })

  it('rejects invalid type value', () => {
    const result = searchSchema.safeParse({ q: 'test', types: ['frame'] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['types', 0])
  })

  it('accepts omitted types (optional)', () => {
    const result = searchSchema.safeParse({ q: 'test' })
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('types')
  })

  /* --- limit --- */

  it('accepts minimum limit (1)', () => {
    const result = searchSchema.safeParse({ q: 'test', limit: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts maximum limit (50)', () => {
    const result = searchSchema.safeParse({ q: 'test', limit: 50 })
    expect(result.success).toBe(true)
  })

  it('rejects limit below minimum (0)', () => {
    const result = searchSchema.safeParse({ q: 'test', limit: 0 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['limit'])
  })

  it('rejects limit above maximum (51)', () => {
    const result = searchSchema.safeParse({ q: 'test', limit: 51 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['limit'])
  })

  it('rejects fractional limit', () => {
    const result = searchSchema.safeParse({ q: 'test', limit: 10.5 })
    expect(result.success).toBe(false)
  })

  /* --- cursor --- */

  it('accepts string cursor', () => {
    const result = searchSchema.safeParse({ q: 'test', cursor: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('accepts omitted cursor (optional)', () => {
    const result = searchSchema.safeParse({ q: 'test' })
    expect(result.success).toBe(true)
    expect(result.data).not.toHaveProperty('cursor')
  })
})
