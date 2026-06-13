import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

// ---------------------------------------------------------------------------
// cn() — clsx + tailwind-merge
// ---------------------------------------------------------------------------

describe('cn', () => {
  it('merges class name strings', () => {
    const result = cn('px-4', 'py-2')
    expect(result).toBe('px-4 py-2')
  })

  it('handles conditional classes', () => {
    const isActive = true
    const isDisabled = false
    const result = cn('base', isActive && 'active', isDisabled && 'disabled')
    expect(result).toContain('base')
    expect(result).toContain('active')
    expect(result).not.toContain('disabled')
  })

  it('deduplicates conflicting tailwind classes (later wins)', () => {
    const result = cn('px-4', 'px-8')
    expect(result).toBe('px-8')
  })

  it('handles arrays of classes', () => {
    const result = cn(['flex', 'items-center'])
    expect(result).toBe('flex items-center')
  })

  it('handles undefined and null gracefully', () => {
    const result = cn('base', undefined, null, 'end')
    expect(result).toBe('base end')
  })

  it('handles empty call', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles object syntax', () => {
    const result = cn({ 'bg-red-500': true, 'bg-blue-500': false, 'text-white': true })
    expect(result).toContain('bg-red-500')
    expect(result).toContain('text-white')
    expect(result).not.toContain('bg-blue-500')
  })

  it('resolves tailwind conflicts with specificity', () => {
    // tailwind-merge resolves conflicting utilities — later takes precedence
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('preserves non-conflicting classes', () => {
    const result = cn('rounded-lg', 'shadow-md', 'border', 'rounded-xl')
    expect(result).toContain('shadow-md')
    expect(result).toContain('border')
    // rounded-xl should win over rounded-lg
    expect(result).toContain('rounded-xl')
    expect(result).not.toContain('rounded-lg')
  })
})
