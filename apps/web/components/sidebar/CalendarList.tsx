'use client'

import * as React from 'react'
import { Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Calendar } from '@poolendar/types'

interface CalendarListProps {
  calendars: Calendar[]
  onToggle: (calendarId: string, active: boolean) => void
  onAddAccount: () => void
}

export function CalendarList({ calendars, onToggle, onAddAccount }: CalendarListProps) {
  function handleToggle(calendar: Calendar) {
    onToggle(calendar.id, !calendar.is_active)
  }

  function handleKeyDown(e: React.KeyboardEvent, calendar: Calendar) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleToggle(calendar)
    }
  }

  return (
    <div className="w-full">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Calendars
      </h3>

      <ul role="list" className="space-y-0.5">
        {calendars.map((calendar) => (
          <li key={calendar.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={calendar.is_active}
              aria-label={`${calendar.is_active ? 'Hide' : 'Show'} ${calendar.name}`}
              onClick={() => handleToggle(calendar)}
              onKeyDown={(e) => handleKeyDown(e, calendar)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5',
                'text-sm text-[var(--fg)]',
                'transition-colors duration-150',
                'hover:bg-[var(--surface-hover)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px]',
                  'border transition-colors duration-150',
                  calendar.is_active
                    ? 'border-transparent'
                    : 'border-[var(--border)] bg-transparent'
                )}
                style={
                  calendar.is_active
                    ? { backgroundColor: calendar.color }
                    : undefined
                }
              >
                {calendar.is_active && (
                  <Check className="h-3 w-3 text-[var(--bg)]" strokeWidth={3} />
                )}
              </span>

              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  !calendar.is_active && 'opacity-40'
                )}
                style={{ backgroundColor: calendar.color }}
                aria-hidden="true"
              />

              <span
                className={cn(
                  'truncate text-left',
                  !calendar.is_active && 'text-[var(--muted)]'
                )}
              >
                {calendar.name}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddAccount}
        className={cn(
          'mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5',
          'text-sm text-[var(--muted)]',
          'transition-colors duration-150',
          'hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
        )}
      >
        <Plus className="h-4 w-4" />
        <span>Add account</span>
      </button>
    </div>
  )
}
