'use client'

import { cn } from '@/lib/utils'

interface TimeColumnProps {
  hourHeight: number
  startHour?: number
  endHour?: number
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

export function TimeColumn({
  hourHeight,
  startHour = 0,
  endHour = 24,
}: TimeColumnProps) {
  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) {
    hours.push(h)
  }

  const totalHeight = (endHour - startHour) * hourHeight

  return (
    <div
      className={cn('relative shrink-0 w-10 md:w-[60px]', 'select-none')}
      style={{ height: totalHeight }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute right-0 pr-1.5 md:pr-3"
          style={{
            top: (hour - startHour) * hourHeight,
            transform: 'translateY(-50%)',
          }}
        >
          {hour !== startHour && (
            <span className="text-[10px] md:text-xs text-[var(--muted)] whitespace-nowrap">
              {formatHourLabel(hour)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
