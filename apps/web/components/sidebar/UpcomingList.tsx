'use client'

import * as React from 'react'
import {
  format,
  isToday,
  isTomorrow,
  differenceInCalendarDays,
} from 'date-fns'
import { Calendar, CheckSquare, Repeat2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type UpcomingItem = {
  id: string
  type: 'event' | 'task' | 'routine'
  title: string
  startTime: Date
  color: string
  subtaskProgress?: { completed: number; total: number } | null
}

interface UpcomingListProps {
  items: UpcomingItem[]
  onItemClick: (id: string, type: 'event' | 'task' | 'routine') => void
}

const TYPE_ICONS = {
  event: Calendar,
  task: CheckSquare,
  routine: Repeat2,
} as const

function formatItemTime(date: Date): string {
  const timeStr = format(date, 'h:mm a')

  if (isToday(date)) {
    return timeStr
  }

  if (isTomorrow(date)) {
    return `Tomorrow, ${format(date, 'h a')}`
  }

  const daysAway = differenceInCalendarDays(date, new Date())
  if (daysAway > 0 && daysAway <= 6) {
    return `${format(date, 'EEE')}, ${format(date, 'h a')}`
  }

  return `${format(date, 'MMM d')}, ${format(date, 'h a')}`
}

export function UpcomingList({ items, onItemClick }: UpcomingListProps) {
  const sorted = React.useMemo(
    () => [...items].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()).slice(0, 5),
    [items]
  )

  if (sorted.length === 0) {
    return (
      <div className="w-full">
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Upcoming
        </h3>
        <p className="px-2 py-4 text-center text-sm text-[var(--muted)]">
          No upcoming items
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Upcoming
      </h3>

      <ul role="list" className="space-y-0.5">
        {sorted.map((item) => {
          const Icon = TYPE_ICONS[item.type]

          return (
            <li key={`${item.type}-${item.id}`}>
              <button
                type="button"
                onClick={() => onItemClick(item.id, item.type)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md px-2 py-2',
                  'text-left text-sm',
                  'transition-colors duration-150',
                  'hover:bg-[var(--surface-hover)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                )}
              >
                <span
                  className="mt-1 flex h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />

                <Icon
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]"
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[var(--fg)]">
                      {item.title}
                    </span>
                    {item.subtaskProgress &&
                      item.subtaskProgress.total > 0 && (
                        <span className="shrink-0 text-[10px] text-[var(--muted)]">
                          {item.subtaskProgress.completed}/{item.subtaskProgress.total}
                        </span>
                      )}
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {formatItemTime(item.startTime)}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
