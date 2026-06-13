'use client'

import { DragOverlay } from '@dnd-kit/core'
import type { Active } from '@dnd-kit/core'
import { format } from 'date-fns'
import { CheckSquare, Repeat2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarItemData } from './calendar-types'

interface CalendarDragOverlayProps {
  active: Active | null
}

function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = num >> 16
  const g = (num >> 8) & 0x00ff
  const b = num & 0x0000ff
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (num >> 16) - amount)
  const g = Math.max(0, ((num >> 8) & 0x00ff) - amount)
  const b = Math.max(0, (num & 0x0000ff) - amount)
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}

function OverlayContent({ item }: { item: CalendarItemData }) {
  const timeLabel = `${format(item.startTime, 'h:mm')} - ${format(item.endTime, 'h:mm a')}`

  if (item.type === 'event') {
    return (
      <div
        className="rounded-md overflow-hidden w-48"
        style={{ backgroundColor: item.color }}
      >
        <div className="flex">
          <div
            className="w-1 shrink-0"
            style={{ backgroundColor: darkenColor(item.color, 40) }}
          />
          <div className="px-2.5 py-2">
            <p className="text-xs font-medium text-white truncate">
              {item.title}
            </p>
            <p className="text-[10px] text-white/70 mt-0.5">{timeLabel}</p>
          </div>
        </div>
      </div>
    )
  }

  if (item.type === 'task') {
    return (
      <div
        className="rounded-md overflow-hidden w-48 border-2 border-dashed"
        style={{
          borderColor: item.color,
          backgroundColor: hexToRgba(item.color, 0.05),
        }}
      >
        <div className="flex items-start gap-1.5 px-2 py-2">
          <CheckSquare
            size={12}
            className="shrink-0 mt-px"
            style={{ color: item.color }}
          />
          <div className="min-w-0">
            <p
              className={cn(
                'text-xs font-medium truncate',
                item.task?.status === 'done' && 'line-through'
              )}
              style={{ color: item.color }}
            >
              {item.title}
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: hexToRgba(item.color, 0.6) }}
            >
              {timeLabel}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-md overflow-hidden w-48 border-2 border-dashed"
      style={{
        borderColor: item.color,
        backgroundColor: hexToRgba(item.color, 0.05),
      }}
    >
      <div className="flex items-start gap-1.5 px-2 py-2">
        <Repeat2
          size={12}
          className="shrink-0 mt-px"
          style={{ color: item.color }}
        />
        <div className="min-w-0">
          <p
            className="text-xs font-medium truncate"
            style={{ color: item.color }}
          >
            {item.title}
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{ color: hexToRgba(item.color, 0.6) }}
          >
            {timeLabel}
          </p>
        </div>
      </div>
    </div>
  )
}

export function CalendarDragOverlay({ active }: CalendarDragOverlayProps) {
  const item = active?.data?.current?.item as CalendarItemData | undefined

  return (
    <DragOverlay dropAnimation={null}>
      {item ? (
        <div
          style={{
            opacity: 0.8,
            boxShadow:
              '0 16px 40px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3)',
            cursor: 'grabbing',
            pointerEvents: 'none',
          }}
        >
          <OverlayContent item={item} />
        </div>
      ) : null}
    </DragOverlay>
  )
}
