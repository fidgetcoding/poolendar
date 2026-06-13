'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover } from './Popover'

export interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  placeholder?: string
  minuteStep?: number
  use24Hour?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

function generateHours(use24Hour: boolean): string[] {
  const hours: string[] = []
  const max = use24Hour ? 24 : 12
  const start = use24Hour ? 0 : 1
  for (let i = start; i <= (use24Hour ? 23 : max); i++) {
    hours.push(String(i).padStart(2, '0'))
  }
  return hours
}

function generateMinutes(step: number): string[] {
  const minutes: string[] = []
  for (let i = 0; i < 60; i += step) {
    minutes.push(String(i).padStart(2, '0'))
  }
  return minutes
}

function parse12HourTime(timeStr: string): {
  hour: string
  minute: string
  period: 'AM' | 'PM'
} {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match) {
    return {
      hour: match[1].padStart(2, '0'),
      minute: match[2],
      period: match[3].toUpperCase() as 'AM' | 'PM',
    }
  }
  return { hour: '12', minute: '00', period: 'AM' }
}

function parse24HourTime(timeStr: string): { hour: string; minute: string } {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (match) {
    return {
      hour: match[1].padStart(2, '0'),
      minute: match[2],
    }
  }
  return { hour: '00', minute: '00' }
}

function format12Hour(hour: string, minute: string, period: 'AM' | 'PM'): string {
  return `${hour}:${minute} ${period}`
}

function format24Hour(hour: string, minute: string): string {
  return `${hour}:${minute}`
}

interface ScrollColumnProps {
  items: string[]
  selectedValue: string
  onSelect: (val: string) => void
  label: string
}

function ScrollColumn({ items, selectedValue, onSelect, label }: ScrollColumnProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const selectedRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current
      const element = selectedRef.current
      const offset = element.offsetTop - container.offsetTop - container.clientHeight / 2 + element.clientHeight / 2
      container.scrollTop = offset
    }
  }, [selectedValue])

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={label}
      className="flex-1 overflow-y-auto h-48 scrollbar-thin"
    >
      {items.map((item) => {
        const isSelected = item === selectedValue
        return (
          <button
            key={item}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(item)}
            className={cn(
              'w-full py-1.5 px-3 text-sm text-center',
              'transition-colors duration-75',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]',
              isSelected
                ? 'bg-[var(--accent)] text-[var(--bg)] font-medium'
                : 'text-[var(--fg)] hover:bg-[var(--surface-hover)]'
            )}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

function TimePicker({
  value,
  onChange,
  placeholder = 'Pick a time',
  minuteStep = 15,
  use24Hour = false,
  disabled = false,
  className,
  id,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const hours = React.useMemo(() => generateHours(use24Hour), [use24Hour])
  const minutes = React.useMemo(() => generateMinutes(minuteStep), [minuteStep])

  const parsedTime = React.useMemo(() => {
    if (!value) {
      return use24Hour
        ? { hour: '09', minute: '00', period: 'AM' as const }
        : { hour: '09', minute: '00', period: 'AM' as const }
    }
    if (use24Hour) {
      const parsed = parse24HourTime(value)
      return { ...parsed, period: 'AM' as const }
    }
    return parse12HourTime(value)
  }, [value, use24Hour])

  function handleHourChange(hour: string) {
    const newTime = use24Hour
      ? format24Hour(hour, parsedTime.minute)
      : format12Hour(hour, parsedTime.minute, parsedTime.period)
    onChange?.(newTime)
  }

  function handleMinuteChange(minute: string) {
    const newTime = use24Hour
      ? format24Hour(parsedTime.hour, minute)
      : format12Hour(parsedTime.hour, minute, parsedTime.period)
    onChange?.(newTime)
  }

  function handlePeriodChange(period: 'AM' | 'PM') {
    if (use24Hour) return
    const newTime = format12Hour(parsedTime.hour, parsedTime.minute, period)
    onChange?.(newTime)
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
        <Clock className="h-4 w-4 shrink-0 text-[var(--muted)]" />
        <span className="truncate">{value || placeholder}</span>
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        position="bottom"
        className="w-56 p-2"
      >
        <div className="flex gap-0 divide-x divide-[var(--border)]">
          <ScrollColumn
            items={hours}
            selectedValue={parsedTime.hour}
            onSelect={handleHourChange}
            label="Hour"
          />
          <ScrollColumn
            items={minutes}
            selectedValue={parsedTime.minute}
            onSelect={handleMinuteChange}
            label="Minute"
          />
          {!use24Hour && (
            <div className="flex flex-col justify-center gap-1 px-2">
              {(['AM', 'PM'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => handlePeriodChange(period)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-xs font-medium',
                    'transition-colors duration-75',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                    parsedTime.period === period
                      ? 'bg-[var(--accent)] text-[var(--bg)]'
                      : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  {period}
                </button>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </div>
  )
}

export { TimePicker }
