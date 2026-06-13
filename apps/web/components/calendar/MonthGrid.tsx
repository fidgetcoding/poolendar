'use client'

import * as React from 'react'
import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarItemData } from './calendar-types'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_ITEMS = 3

interface MonthGridProps {
  currentDate: Date
  visibleDays: Date[]
  items: CalendarItemData[]
  onItemClick?: (item: CalendarItemData) => void
  onItemDoubleClick?: (item: CalendarItemData) => void
}

export function MonthGrid({
  currentDate,
  visibleDays,
  items,
  onItemClick,
  onItemDoubleClick,
}: MonthGridProps) {
  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className={cn(
              'py-2 text-center text-xs font-medium uppercase',
              'text-[var(--muted)]',
              'border-l border-[var(--border)] first:border-l-0'
            )}
          >
            {name}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {visibleDays.map((day) => {
          const dayItems = items.filter((item) => isSameDay(item.startTime, day))
          const today = isToday(day)
          const inMonth = isSameMonth(day, currentDate)
          const visible = dayItems.slice(0, MAX_VISIBLE_ITEMS)
          const overflowCount = dayItems.length - MAX_VISIBLE_ITEMS

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[100px] p-1',
                'border-b border-l border-[var(--border)]',
                !inMonth && 'opacity-40'
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    'flex items-center justify-center',
                    'w-6 h-6 rounded-full text-xs font-medium',
                    today
                      ? 'bg-[var(--accent)] text-[var(--bg)]'
                      : 'text-[var(--fg)]'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              <div className="mt-0.5 flex flex-col gap-0.5">
                {visible.map((item) => (
                  <MonthPill
                    key={item.id}
                    item={item}
                    onItemClick={onItemClick}
                    onItemDoubleClick={onItemDoubleClick}
                  />
                ))}

                {overflowCount > 0 && (
                  <button
                    type="button"
                    className={cn(
                      'text-left text-[10px] font-medium px-1.5 py-0.5 rounded',
                      'text-[var(--muted)] hover:text-[var(--fg)]',
                      'hover:bg-[var(--surface-hover)]',
                      'transition-colors duration-150'
                    )}
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month pill sub-component
// ---------------------------------------------------------------------------

interface MonthPillProps {
  item: CalendarItemData
  onItemClick?: (item: CalendarItemData) => void
  onItemDoubleClick?: (item: CalendarItemData) => void
}

function MonthPill({ item, onItemClick, onItemDoubleClick }: MonthPillProps) {
  const isEvent = item.type === 'event'
  const isCompleted = item.type === 'task' && item.task?.status === 'done'

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onItemClick?.(item)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onItemDoubleClick?.(item)
  }

  if (isEvent) {
    return (
      <button
        type="button"
        className={cn(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-left',
          'transition-[filter] duration-150 hover:brightness-110',
          'w-full overflow-hidden'
        )}
        style={{ backgroundColor: item.color }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <span className="text-[10px] font-medium text-white truncate">
          {item.title}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-left',
        'transition-colors duration-150',
        'hover:bg-[var(--surface-hover)]',
        'w-full overflow-hidden'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: item.color }}
      />
      <span
        className={cn(
          'text-[10px] font-medium truncate',
          isCompleted
            ? 'text-[var(--muted)] line-through'
            : 'text-[var(--fg)]'
        )}
      >
        {item.title}
      </span>
    </button>
  )
}
