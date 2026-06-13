'use client'

import * as React from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover } from './Popover'

export interface DatePickerProps {
  value?: Date | null
  onChange?: (date: Date) => void
  placeholder?: string
  dateFormat?: string
  disabled?: boolean
  className?: string
  id?: string
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  dateFormat = 'MMM d, yyyy',
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewMonth, setViewMonth] = React.useState<Date>(
    value || new Date()
  )
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (value) {
      setViewMonth(value)
    }
  }, [value])

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  function handleSelect(day: Date) {
    onChange?.(day)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handlePrevMonth(e: React.MouseEvent) {
    e.stopPropagation()
    setViewMonth((prev) => subMonths(prev, 1))
  }

  function handleNextMonth(e: React.MouseEvent) {
    e.stopPropagation()
    setViewMonth((prev) => addMonths(prev, 1))
  }

  function handleGridKeyDown(e: React.KeyboardEvent) {
    if (!value && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return
    }

    const current = value || new Date()

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault()
        const prev = new Date(current)
        prev.setDate(prev.getDate() - 1)
        onChange?.(prev)
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        const next = new Date(current)
        next.setDate(next.getDate() + 1)
        onChange?.(next)
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prev = new Date(current)
        prev.setDate(prev.getDate() - 7)
        onChange?.(prev)
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        const next = new Date(current)
        next.setDate(next.getDate() + 7)
        onChange?.(next)
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (value) {
          setOpen(false)
          triggerRef.current?.focus()
        }
        break
      }
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm',
          'bg-[var(--surface)] text-[var(--fg)]',
          'border border-[var(--border)]',
          'transition-colors duration-150',
          'hover:border-[var(--muted)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-[var(--muted)]'
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <span className="truncate">
          {value ? format(value, dateFormat) : placeholder}
        </span>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        position="bottom"
        className="w-72 p-3"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={cn(
              'rounded-lg p-1.5',
              'text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-[var(--fg)]">
            {format(viewMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className={cn(
              'rounded-lg p-1.5',
              'text-[var(--muted)] hover:text-[var(--fg)]',
              'hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            )}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div
          className="grid grid-cols-7 gap-0"
          role="grid"
          aria-label="Calendar"
          onKeyDown={handleGridKeyDown}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="flex h-8 items-center justify-center text-xs font-medium text-[var(--muted)]"
              role="columnheader"
              aria-label={day}
            >
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const inCurrentMonth = isSameMonth(day, viewMonth)
            const selected = value ? isSameDay(day, value) : false
            const today = isToday(day)

            return (
              <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => handleSelect(day)}
                className={cn(
                  'flex h-8 w-full items-center justify-center rounded-lg text-sm',
                  'transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  inCurrentMonth
                    ? 'text-[var(--fg)]'
                    : 'text-[var(--muted)] opacity-40',
                  !selected && inCurrentMonth && 'hover:bg-[var(--surface-hover)]',
                  today && !selected && 'ring-1 ring-[var(--accent)]',
                  selected && 'bg-[var(--accent)] text-[var(--bg)] font-medium'
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </Popover>
    </div>
  )
}

export { DatePicker }
