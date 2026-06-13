'use client'

import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CheckSquare, Repeat2 } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CalendarItemData } from './calendar-types'

interface CalendarItemProps {
  item: CalendarItemData
  style: React.CSSProperties
  onItemClick?: (item: CalendarItemData) => void
  onItemDoubleClick?: (item: CalendarItemData) => void
  onResizeStart?: (item: CalendarItemData) => void
  onItemResize?: (itemId: string, itemType: string, newEnd: Date) => void
  onRoutineCheckboxClick?: (item: CalendarItemData) => void
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount)
  const b = Math.max(0, (num & 0x0000ff) - amount)
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = num >> 16
  const g = (num >> 8) & 0x00ff
  const b = num & 0x0000ff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatTimeRange(start: Date, end: Date): string {
  return `${format(start, 'h:mm')} - ${format(end, 'h:mm a')}`
}

export const CalendarItem = React.memo(function CalendarItem({
  item,
  style: positionStyle,
  onItemClick,
  onItemDoubleClick,
  onResizeStart,
  onItemResize,
  onRoutineCheckboxClick,
}: CalendarItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { type: 'calendar-item', item },
  })

  const isTaskCompleted = item.type === 'task' && item.task?.status === 'done'
  const isRoutineCompleted = item.type === 'routine' && item.routineInstanceStatus === 'completed'
  const isCompleted = isTaskCompleted || isRoutineCompleted
  const heightNum = parseFloat(String(positionStyle.height) || '0')
  const isCompact = heightNum < 40

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onItemClick?.(item)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onItemDoubleClick?.(item)
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    onResizeStart?.(item)

    const startY = e.clientY
    const originalEndTime = item.endTime
    const hourHeightPx = 60 // pixels per hour, matches DayColumn default

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY
      const deltaMinutes = Math.round(deltaY / (hourHeightPx / 60) / 15) * 15
      const newEnd = new Date(originalEndTime.getTime() + deltaMinutes * 60000)
      if (newEnd > item.startTime) {
        onItemResize?.(item.id, item.type, newEnd)
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const mergedStyle: React.CSSProperties = {
    ...positionStyle,
    opacity: isDragging ? 0.4 : isCompleted ? 0.5 : 1,
    zIndex: isDragging ? 100 : undefined,
  }

  if (item.type === 'event') {
    const barColor = darkenColor(item.color, 40)

    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-calendar-item
        data-item-id={item.id}
        data-item-type={item.type}
        style={mergedStyle}
        className={cn(
          'absolute rounded-md overflow-hidden cursor-pointer',
          'transition-[filter] duration-150',
          'hover:brightness-110',
          'group'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="absolute inset-0 rounded-md"
          style={{ backgroundColor: item.color }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: barColor }}
        />
        <div className="relative pl-2.5 pr-2 py-1 min-h-0 overflow-hidden">
          {isCompact ? (
            <p className="text-xs font-medium text-white truncate leading-tight">
              {item.title}
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-white truncate leading-tight">
                {item.title}
              </p>
              <p className="text-[10px] text-white/70 truncate leading-tight mt-0.5">
                {formatTimeRange(item.startTime, item.endTime)}
              </p>
            </>
          )}
        </div>
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-2',
            'cursor-ns-resize opacity-0 group-hover:opacity-100',
            'transition-opacity duration-150'
          )}
          style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          onMouseDown={handleResizeMouseDown}
        />
      </div>
    )
  }

  if (item.type === 'task') {
    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        data-calendar-item
        data-item-id={item.id}
        data-item-type={item.type}
        style={mergedStyle}
        className={cn(
          'absolute rounded-md overflow-hidden cursor-pointer',
          'transition-[filter] duration-150',
          'hover:brightness-110',
          'group'
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="absolute inset-0 rounded-md border-2 border-dashed"
          style={{
            borderColor: item.color,
            backgroundColor: hexToRgba(item.color, 0.05),
          }}
        />
        <div className="relative flex items-start gap-1.5 pl-2 pr-2 py-1 min-h-0 overflow-hidden">
          <CheckSquare
            size={12}
            className="shrink-0 mt-px"
            style={{ color: item.color }}
          />
          <div className="min-w-0 flex-1">
            {isCompact ? (
              <div className="flex items-center gap-1.5">
                <p
                  className={cn(
                    'text-xs font-medium truncate leading-tight',
                    isCompleted && 'line-through'
                  )}
                  style={{ color: item.color }}
                >
                  {item.title}
                </p>
                {item.subtaskProgress && (
                  <span
                    className="text-[10px] shrink-0"
                    style={{ color: item.color }}
                  >
                    {item.subtaskProgress.completed}/{item.subtaskProgress.total}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <p
                    className={cn(
                      'text-xs font-medium truncate leading-tight',
                      isCompleted && 'line-through'
                    )}
                    style={{ color: item.color }}
                  >
                    {item.title}
                  </p>
                  {item.subtaskProgress && (
                    <span
                      className="text-[10px] shrink-0"
                      style={{ color: item.color }}
                    >
                      {item.subtaskProgress.completed}/{item.subtaskProgress.total}
                    </span>
                  )}
                </div>
                <p
                  className="text-[10px] truncate leading-tight mt-0.5"
                  style={{ color: hexToRgba(item.color, 0.6) }}
                >
                  {formatTimeRange(item.startTime, item.endTime)}
                </p>
              </>
            )}
          </div>
        </div>
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-2',
            'cursor-ns-resize opacity-0 group-hover:opacity-100',
            'transition-opacity duration-150'
          )}
          style={{ backgroundColor: hexToRgba(item.color, 0.15) }}
          onMouseDown={handleResizeMouseDown}
        />
      </div>
    )
  }

  // Routine — checkbox + repeat icon
  function handleRoutineCheckbox(e: React.MouseEvent) {
    e.stopPropagation()
    onRoutineCheckboxClick?.(item)
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-calendar-item
      data-item-id={item.id}
      data-item-type={item.type}
      style={mergedStyle}
      className={cn(
        'absolute rounded-md overflow-hidden cursor-pointer',
        'transition-[filter] duration-150',
        'hover:brightness-110',
        'group'
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute inset-0 rounded-md border-2 border-dashed"
        style={{
          borderColor: item.color,
          backgroundColor: hexToRgba(item.color, 0.05),
        }}
      />
      <div className="relative flex items-start gap-1.5 pl-2 pr-2 py-1 min-h-0 overflow-hidden">
        {/* Checkbox for routine instance completion */}
        <button
          type="button"
          onClick={handleRoutineCheckbox}
          className={cn(
            'shrink-0 w-3 h-3 rounded border flex items-center justify-center mt-px',
            'transition-colors duration-150'
          )}
          style={{
            borderColor: isRoutineCompleted ? item.color : hexToRgba(item.color, 0.5),
            backgroundColor: isRoutineCompleted ? item.color : 'transparent',
          }}
          aria-label={isRoutineCompleted ? 'Uncheck routine' : 'Complete routine'}
        >
          {isRoutineCompleted && (
            <CheckSquare size={8} style={{ color: '#fff' }} />
          )}
        </button>
        {/* Repeat icon */}
        <Repeat2
          size={10}
          className="shrink-0 mt-0.5"
          style={{ color: hexToRgba(item.color, 0.6) }}
        />
        <div className="min-w-0 flex-1">
          {isCompact ? (
            <p
              className={cn(
                'text-xs font-medium truncate leading-tight',
                isRoutineCompleted && 'line-through'
              )}
              style={{ color: item.color }}
            >
              {item.title}
            </p>
          ) : (
            <>
              <p
                className={cn(
                  'text-xs font-medium truncate leading-tight',
                  isRoutineCompleted && 'line-through'
                )}
                style={{ color: item.color }}
              >
                {item.title}
              </p>
              <p
                className="text-[10px] truncate leading-tight mt-0.5"
                style={{ color: hexToRgba(item.color, 0.6) }}
              >
                {formatTimeRange(item.startTime, item.endTime)}
              </p>
            </>
          )}
        </div>
      </div>
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-2',
          'cursor-ns-resize opacity-0 group-hover:opacity-100',
          'transition-opacity duration-150'
        )}
        style={{ backgroundColor: hexToRgba(item.color, 0.15) }}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  )
})
