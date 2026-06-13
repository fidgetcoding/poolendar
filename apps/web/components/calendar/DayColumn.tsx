'use client'

import * as React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarItemData } from './calendar-types'
import { CalendarItem } from './CalendarItem'

interface DayColumnProps {
  date: Date
  items: CalendarItemData[]
  hourHeight: number
  isToday: boolean
  onTimeSlotClick?: (date: Date, time: Date) => void
  onItemClick?: (item: CalendarItemData) => void
  onItemDoubleClick?: (item: CalendarItemData) => void
}

interface LayoutColumn {
  item: CalendarItemData
  columnIndex: number
  totalColumns: number
}

function computeOverlapLayout(items: CalendarItemData[]): LayoutColumn[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    const diff = a.startTime.getTime() - b.startTime.getTime()
    if (diff !== 0) return diff
    return b.endTime.getTime() - a.endTime.getTime()
  })

  const result: LayoutColumn[] = []
  const groups: CalendarItemData[][] = []
  let currentGroup: CalendarItemData[] = []
  let currentGroupEnd = 0

  for (const item of sorted) {
    const itemStart = item.startTime.getTime()

    if (currentGroup.length === 0 || itemStart < currentGroupEnd) {
      currentGroup.push(item)
      currentGroupEnd = Math.max(currentGroupEnd, item.endTime.getTime())
    } else {
      groups.push(currentGroup)
      currentGroup = [item]
      currentGroupEnd = item.endTime.getTime()
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup)
  }

  for (const group of groups) {
    const columns: CalendarItemData[][] = []

    for (const item of group) {
      let placed = false
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1]
        if (item.startTime.getTime() >= lastInCol.endTime.getTime()) {
          columns[col].push(item)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([item])
      }
    }

    const totalColumns = columns.length
    for (let col = 0; col < columns.length; col++) {
      for (const item of columns[col]) {
        result.push({ item, columnIndex: col, totalColumns })
      }
    }
  }

  return result
}

function getTimePosition(time: Date, hourHeight: number): number {
  const hours = time.getHours()
  const minutes = time.getMinutes()
  return (hours + minutes / 60) * hourHeight
}

function snapToQuarterHour(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

const CURRENT_TIME_UPDATE_MS = 60_000
const MIN_ITEM_HEIGHT = 20

export function DayColumn({
  date,
  items,
  hourHeight,
  isToday,
  onTimeSlotClick,
  onItemClick,
  onItemDoubleClick,
}: DayColumnProps) {
  const [currentMinutes, setCurrentMinutes] = React.useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${date.toISOString()}`,
    data: { type: 'day-column', date },
  })

  React.useEffect(() => {
    if (!isToday) return

    function tick() {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }

    const id = setInterval(tick, CURRENT_TIME_UPDATE_MS)
    return () => clearInterval(id)
  }, [isToday])

  const totalHeight = 24 * hourHeight
  const layout = computeOverlapLayout(items)
  const currentTimeTop = (currentMinutes / 60) * hourHeight

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onTimeSlotClick) return

    const rect = e.currentTarget.getBoundingClientRect()
    const yOffset = e.clientY - rect.top
    const rawMinutes = (yOffset / hourHeight) * 60
    const snappedMinutes = snapToQuarterHour(rawMinutes)
    const clickedHour = Math.floor(snappedMinutes / 60)
    const clickedMinute = snappedMinutes % 60

    const clickTime = new Date(date)
    clickTime.setHours(clickedHour, clickedMinute, 0, 0)
    onTimeSlotClick(date, clickTime)
  }

  const hours: number[] = []
  for (let h = 0; h < 24; h++) {
    hours.push(h)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 min-w-0',
        'border-l border-[var(--border)]',
        isOver && 'bg-[var(--surface-hover)]'
      )}
      style={{ height: totalHeight }}
      onClick={handleColumnClick}
    >
      {hours.map((hour) => (
        <React.Fragment key={hour}>
          <div
            className="absolute left-0 right-0 border-t border-[var(--border)] opacity-50"
            style={{ top: hour * hourHeight }}
          />
          <div
            className="absolute left-0 right-0 border-t border-[var(--border)] opacity-25"
            style={{
              top: hour * hourHeight + hourHeight / 2,
              borderStyle: 'dashed',
            }}
          />
        </React.Fragment>
      ))}

      {layout.map(({ item, columnIndex, totalColumns }) => {
        const top = getTimePosition(item.startTime, hourHeight)
        const bottom = getTimePosition(item.endTime, hourHeight)
        const rawHeight = bottom - top
        const height = Math.max(rawHeight, MIN_ITEM_HEIGHT)
        const widthPercent = 100 / totalColumns
        const leftPercent = columnIndex * widthPercent

        return (
          <CalendarItem
            key={item.id}
            item={item}
            style={{
              top,
              height,
              width: `calc(${widthPercent}% - 2px)`,
              left: `${leftPercent}%`,
            }}
            onItemClick={onItemClick}
            onItemDoubleClick={onItemDoubleClick}
          />
        )
      })}

      {isToday && (
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{ top: currentTimeTop }}
        >
          <div className="relative">
            <div
              className="absolute rounded-full"
              style={{
                width: 10,
                height: 10,
                backgroundColor: '#ef4444',
                left: -5,
                top: -4,
              }}
            />
            <div
              className="absolute left-0 right-0"
              style={{
                height: 2,
                backgroundColor: '#ef4444',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
