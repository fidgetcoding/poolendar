'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import {
  Clock,
  MapPin,
  Pencil,
  Trash2,
  Check,
  SkipForward,
  Repeat2,
  Video,
  CalendarDays,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarEvent, Task, Routine } from '@poolendar/types'

type PreviewItem = {
  type: 'event' | 'task' | 'routine'
  event?: CalendarEvent
  task?: Task
  routine?: Routine
  calendarName?: string
  calendarColor?: string
}

interface PreviewPopoverProps {
  item: PreviewItem
  anchorRect: DOMRect | null
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onComplete?: () => void
  onSkip?: () => void
}

const POPOVER_WIDTH = 300
const POPOVER_HEIGHT_ESTIMATE = 280
const VIEWPORT_PADDING = 12
const GAP = 8

function computePosition(anchor: DOMRect): { top: number; left: number } {
  let top = anchor.bottom + GAP
  let left = anchor.left

  if (top + POPOVER_HEIGHT_ESTIMATE > window.innerHeight - VIEWPORT_PADDING) {
    top = anchor.top - POPOVER_HEIGHT_ESTIMATE - GAP
  }
  if (top < VIEWPORT_PADDING) {
    top = VIEWPORT_PADDING
  }

  if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
    left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING
  }

  return { top, left }
}

const IMPORTANCE_COLORS: Record<string, string> = {
  highest: '#ef4444',
  high: '#f97316',
  normal: '#f9a825',
  low: '#3b82f6',
  lowest: '#6b7280',
}

function ImportanceBadge({ importance }: { importance: string }) {
  const color = IMPORTANCE_COLORS[importance] ?? IMPORTANCE_COLORS.normal
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {importance}
    </span>
  )
}

function SubtaskProgress({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  const percent = total > 0 ? (completed / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-[var(--muted)] shrink-0">
        {completed}/{total} complete
      </span>
    </div>
  )
}

export function PreviewPopover({
  item,
  anchorRect,
  onClose,
  onEdit,
  onDelete,
  onComplete,
  onSkip,
}: PreviewPopoverProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  if (!isMounted || !anchorRect) return null

  const position = computePosition(anchorRect)
  const color = item.calendarColor ?? '#f9a825'

  let title = ''
  let timeRange = ''
  let location: string | null = null
  let conferenceUrl: string | null = null

  if (item.type === 'event' && item.event) {
    const e = item.event
    title = e.title
    timeRange = `${format(new Date(e.start_time), 'h:mm a')} - ${format(new Date(e.end_time), 'h:mm a')}`
    location = e.location
    conferenceUrl = e.conferencing_url
  } else if (item.type === 'task' && item.task) {
    const t = item.task
    title = t.title
    if (t.scheduled_start && t.scheduled_end) {
      timeRange = `${format(new Date(t.scheduled_start), 'h:mm a')} - ${format(new Date(t.scheduled_end), 'h:mm a')}`
    }
    location = t.location
  } else if (item.type === 'routine' && item.routine) {
    const r = item.routine
    title = r.title
    const startParts = r.start_time.split(':')
    const endParts = r.end_time.split(':')
    const startDate = new Date()
    startDate.setHours(parseInt(startParts[0], 10) || 0, parseInt(startParts[1], 10) || 0)
    const endDate = new Date()
    endDate.setHours(parseInt(endParts[0], 10) || 0, parseInt(endParts[1], 10) || 0)
    timeRange = `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`
    location = r.location
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Preview: ${title}`}
      className={cn(
        'fixed z-50',
        'rounded-lg border border-[var(--border)]',
        'bg-[var(--surface)] shadow-xl shadow-black/40',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
      }}
    >
      {/* Color bar */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: color }}
      />

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'absolute top-2 right-2',
          'flex items-center justify-center w-6 h-6 rounded',
          'text-[var(--muted)] hover:text-[var(--fg)]',
          'hover:bg-[var(--surface-hover)]',
          'transition-colors duration-150'
        )}
      >
        <X size={14} />
      </button>

      <div className="px-4 pt-3 pb-2">
        {/* Title */}
        <h3 className="text-base font-semibold text-[var(--fg)] pr-6">
          {title}
        </h3>

        {/* Time */}
        {timeRange && (
          <div className="flex items-center gap-2 mt-2 text-sm text-[var(--muted)]">
            <Clock size={14} className="shrink-0" />
            <span>{timeRange}</span>
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--muted)]">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}

        {/* Calendar */}
        {item.calendarName && (
          <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--muted)]">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span>{item.calendarName}</span>
          </div>
        )}

        {/* Event-specific */}
        {item.type === 'event' && item.event && (
          <>
            {item.event.attendees.length > 0 && (
              <div className="mt-2 text-xs text-[var(--muted)]">
                {item.event.attendees.length} attendee{item.event.attendees.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        )}

        {/* Task-specific */}
        {item.type === 'task' && item.task && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <ImportanceBadge importance={item.task.importance} />
              {item.task.due_date && (
                <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                  <CalendarDays size={12} />
                  <span>Due {format(new Date(item.task.due_date), 'MMM d')}</span>
                </div>
              )}
            </div>
            {item.task.subtasks && item.task.subtasks.length > 0 && (
              <SubtaskProgress
                completed={item.task.subtasks.filter((s) => s.completed).length}
                total={item.task.subtasks.length}
              />
            )}
          </div>
        )}

        {/* Routine-specific */}
        {item.type === 'routine' && item.routine && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--muted)]">
            <Repeat2 size={12} />
            <span>{item.routine.recurrence_rule ?? 'Recurring'}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
            'text-[var(--fg)] hover:bg-[var(--surface-hover)]',
            'transition-colors duration-150'
          )}
        >
          <Pencil size={14} />
          <span>Edit</span>
        </button>

        {item.type === 'event' && conferenceUrl && (
          <a
            href={conferenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
              'text-[var(--fg)] hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <Video size={14} />
            <span>Join</span>
          </a>
        )}

        {item.type === 'task' && onComplete && (
          <button
            type="button"
            onClick={onComplete}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
              'text-[var(--success)] hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <Check size={14} />
            <span>Complete</span>
          </button>
        )}

        {item.type === 'routine' && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
              'text-[var(--muted)] hover:bg-[var(--surface-hover)]',
              'transition-colors duration-150'
            )}
          >
            <SkipForward size={14} />
            <span>Skip</span>
          </button>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            'text-[var(--muted)] hover:text-[var(--destructive)]',
            'hover:bg-[var(--surface-hover)]',
            'transition-colors duration-150'
          )}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>,
    document.body
  )
}
