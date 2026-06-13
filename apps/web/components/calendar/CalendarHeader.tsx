'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameYear,
} from 'date-fns'
import { cn } from '@/lib/utils'

interface CalendarHeaderProps {
  currentDate: Date
  view: 'day' | 'week' | 'month'
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onViewChange: (view: 'day' | 'week' | 'month') => void
}

const VIEW_OPTIONS: { value: 'day' | 'week' | 'month'; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function formatDateLabel(date: Date, view: 'day' | 'week' | 'month'): string {
  switch (view) {
    case 'day':
      return format(date, 'EEEE, MMMM d, yyyy')
    case 'week': {
      const weekStart = startOfWeek(date, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
      if (!isSameYear(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d, yyyy')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
      if (!isSameMonth(weekStart, weekEnd)) {
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`
    }
    case 'month':
      return format(date, 'MMMM yyyy')
  }
}

export function CalendarHeader({
  currentDate,
  view,
  onToday,
  onPrev,
  onNext,
  onViewChange,
}: CalendarHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-[var(--surface)] border-b border-[var(--border)]',
        'select-none'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToday}
          className={cn(
            'text-sm font-medium text-[var(--fg)]',
            'hover:underline underline-offset-4',
            'transition-all duration-150'
          )}
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous"
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Next"
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <h2 className="text-lg font-semibold text-[var(--fg)]">
          {formatDateLabel(currentDate, view)}
        </h2>
      </div>

      <div
        className={cn(
          'flex items-center rounded-lg',
          'border border-[var(--border)]',
          'overflow-hidden'
        )}
      >
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onViewChange(option.value)}
            className={cn(
              'relative px-4 py-1.5 text-sm font-medium',
              'transition-colors duration-150',
              view === option.value
                ? 'text-[var(--accent)] bg-[var(--surface-hover)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {option.label}
            {view === option.value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
