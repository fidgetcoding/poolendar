'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export const IMPORTANCE_OPTIONS = [
  { value: 'lowest', label: 'Lowest', color: '#6b7280' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'normal', label: 'Normal', color: '#f9a825' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'highest', label: 'Highest', color: '#ef4444' },
] as const

/**
 * Format a datetime string, falling back when it is absent or not a valid
 * date (e.g. a routine's "HH:mm" value reaching an event-tab field init).
 */
export function safeFormatDate(
  value: string | undefined,
  fmt: string,
  fallback: string
): string {
  if (!value) return fallback
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  return format(d, fmt)
}

export function fieldClass(extra?: string) {
  return cn(
    'w-full px-3 py-2 text-sm rounded-md',
    'bg-[var(--bg)] border border-[var(--border)]',
    'text-[var(--fg)] placeholder:text-[var(--muted)]',
    'focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--surface)]',
    extra
  )
}

export function SectionDivider() {
  return <div className="border-t border-[var(--border)] my-4" />
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
      {children}
    </label>
  )
}

export function ToggleGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; icon?: React.ElementType }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
      {options.map((opt) => {
        const active = value === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium',
              'transition-colors duration-150',
              'border-l border-[var(--border)] first:border-l-0',
              active
                ? 'bg-[var(--accent)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {Icon && <Icon size={12} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
