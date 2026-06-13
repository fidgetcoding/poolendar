'use client'

import * as React from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniCalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
  datesWithItems?: Date[]
}

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

export function MiniCalendar({
  selectedDate,
  onDateSelect,
  datesWithItems = [],
}: MiniCalendarProps) {
  const [viewMonth, setViewMonth] = React.useState(() => startOfMonth(selectedDate))

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  function hasItems(day: Date): boolean {
    return datesWithItems.some((d) => isSameDay(d, day))
  }

  function handlePrevMonth() {
    setViewMonth((prev) => subMonths(prev, 1))
  }

  function handleNextMonth() {
    setViewMonth((prev) => addMonths(prev, 1))
  }

  function handleKeyDown(e: React.KeyboardEvent, day: Date) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onDateSelect(day)
    }
  }

  return (
    <div className="w-full max-w-[240px] select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-medium text-[var(--fg)]">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded',
              'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded',
              'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="grid grid-cols-7 gap-0"
        role="grid"
        aria-label={format(viewMonth, 'MMMM yyyy')}
      >
        {DAY_HEADERS.map((header, i) => (
          <div
            key={i}
            role="columnheader"
            className="flex h-7 w-full items-center justify-center text-[10px] font-medium text-[var(--muted)]"
          >
            {header}
          </div>
        ))}

        {days.map((day) => {
          const inCurrentMonth = isSameMonth(day, viewMonth)
          const today = isToday(day)
          const selected = isSameDay(day, selectedDate)
          const itemDot = hasItems(day)

          return (
            <div
              key={day.toISOString()}
              className="flex flex-col items-center justify-center"
            >
              <button
                type="button"
                role="gridcell"
                tabIndex={inCurrentMonth ? 0 : -1}
                aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                aria-selected={selected}
                aria-current={today ? 'date' : undefined}
                onClick={() => onDateSelect(day)}
                onKeyDown={(e) => handleKeyDown(e, day)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full',
                  'text-xs transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  !inCurrentMonth && 'text-[var(--muted)] opacity-40',
                  inCurrentMonth && !selected && !today && 'text-[var(--fg)] hover:bg-[var(--surface-hover)]',
                  today && !selected && 'ring-1 ring-[var(--accent)] text-[var(--accent)]',
                  selected && 'bg-[var(--accent)] text-[var(--bg)] font-medium'
                )}
              >
                {format(day, 'd')}
              </button>
              <div className="h-1 flex items-center justify-center">
                {itemDot && inCurrentMonth && (
                  <span
                    className={cn(
                      'block h-1 w-1 rounded-full',
                      selected ? 'bg-[var(--bg)]' : 'bg-[var(--accent)]'
                    )}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
