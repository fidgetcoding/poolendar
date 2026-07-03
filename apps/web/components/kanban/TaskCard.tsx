'use client'

import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CheckCircle2,
  Circle,
  Calendar,
  Clock,
  GripVertical,
  ChevronRight,
} from 'lucide-react'
import type { Task, TaskImportance } from '@poolendar/types'
import { isToday, isPast, format, parseISO } from 'date-fns'

const IMPORTANCE_CONFIG: Record<
  TaskImportance,
  { color: string; label: string }
> = {
  highest: { color: '#ef4444', label: 'Highest' },
  high: { color: '#f97316', label: 'High' },
  normal: { color: 'var(--muted)', label: 'Normal' },
  low: { color: '#6b7280', label: 'Low' },
  lowest: { color: '#4b5563', label: 'Lowest' },
}

interface TaskCardProps {
  task: Task
  onTaskClick: (task: Task) => void
  onTaskComplete: (taskId: string) => void
  parentTitle?: string
  isDragOverlay?: boolean
}

export const TaskCard = React.memo(function TaskCard({
  task,
  onTaskClick,
  onTaskComplete,
  parentTitle,
  isDragOverlay = false,
}: TaskCardProps) {
  const sortable = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: isDragOverlay,
  })

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable

  const transformStyle = CSS.Transform.toString(transform)

  const isCompleted = task.status === 'done'
  const subtasks = task.subtasks ?? []
  const hasSubtasks = subtasks.length > 0
  const subtasksDone = subtasks.filter((s) => s.completed).length
  const subtasksTotal = subtasks.length
  const subtaskProgress =
    subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0

  const hasSchedule = Boolean(task.scheduled_start && task.scheduled_end)
  const hasTimeEstimate = Boolean(task.time_estimate_minutes)
  const tags = task.tags ?? []

  function getDueDateInfo(): {
    text: string
    color: string
  } | null {
    if (!task.due_date) return null
    const date = parseISO(task.due_date)
    if (isPast(date) && !isToday(date)) {
      return { text: format(date, 'MMM d'), color: 'var(--destructive)' }
    }
    if (isToday(date)) {
      return { text: 'Today', color: 'var(--accent)' }
    }
    return { text: format(date, 'MMM d'), color: 'var(--muted)' }
  }

  function formatTimeEstimate(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remaining = minutes % 60
    if (remaining === 0) return `${hours}h`
    return `${hours}h ${remaining}m`
  }

  const dueInfo = getDueDateInfo()
  const importanceCfg = IMPORTANCE_CONFIG[task.importance]

  const cardStyle: React.CSSProperties = {
    transform: transformStyle ?? undefined,
    transition: transition ?? undefined,
    opacity: isDragging ? 0.3 : 1,
    backgroundColor: 'var(--surface)',
    borderColor: 'var(--border)',
  }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={cardStyle}
      className="group rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:border-[color:var(--accent)]/30 hover:shadow-md"
      onClick={() => onTaskClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTaskClick(task)
        }
      }}
    >
      {/* Top row: drag handle + checkbox + title */}
      <div className="flex items-start gap-2">
        {!isDragOverlay && (
          <div
            className="shrink-0 mt-0.5 cursor-grab opacity-0 group-hover:opacity-40 transition-opacity duration-150"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} style={{ color: 'var(--muted)' }} />
          </div>
        )}

        <button
          type="button"
          className="shrink-0 mt-0.5"
          onClick={(e) => {
            e.stopPropagation()
            onTaskComplete(task.id)
          }}
        >
          {isCompleted ? (
            <CheckCircle2
              size={16}
              style={{ color: 'var(--success)' }}
            />
          ) : (
            <Circle
              size={16}
              style={{ color: 'var(--muted)' }}
              className="hover:text-[color:var(--accent)] transition-colors duration-150"
            />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-snug truncate"
            style={{
              color: isCompleted ? 'var(--muted)' : 'var(--fg)',
              textDecoration: isCompleted ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </p>

          {/* Description preview (#40) — truncated to two lines */}
          {task.notes && (
            <p
              className="mt-0.5 text-xs leading-snug line-clamp-2"
              style={{ color: 'var(--muted)' }}
            >
              {task.notes}
            </p>
          )}
        </div>
      </div>

      {/* Parent breadcrumb badge */}
      {parentTitle && (
        <div className="mt-2 ml-8">
          <span
            className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'rgba(249, 168, 37, 0.08)',
              color: 'var(--accent)',
            }}
          >
            <ChevronRight size={10} />
            <span className="truncate max-w-[140px]">{parentTitle}</span>
          </span>
        </div>
      )}

      {/* Metadata row: importance badge + due date + schedule + time estimate */}
      <div className="flex items-center gap-2 mt-2 ml-8 flex-wrap">
        {task.importance !== 'normal' && (
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${importanceCfg.color}18`,
              color: importanceCfg.color,
            }}
          >
            {importanceCfg.label}
          </span>
        )}

        {dueInfo && (
          <span className="text-xs flex items-center gap-1" style={{ color: dueInfo.color }}>
            <Calendar size={10} />
            {dueInfo.text}
          </span>
        )}

        {hasSchedule && (
          <span
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            <Calendar size={10} />
            Scheduled
          </span>
        )}

        {hasTimeEstimate && task.time_estimate_minutes && (
          <span
            className="text-xs flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            <Clock size={10} />
            {formatTimeEstimate(task.time_estimate_minutes)}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 ml-8 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `${tag.color}22`,
                color: tag.color,
              }}
            >
              {tag.prefix ? `${tag.prefix} ${tag.name}` : tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Subtask progress bar */}
      {hasSubtasks && (
        <div className="flex items-center gap-2 mt-2.5 ml-8">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${subtaskProgress}%`,
                backgroundColor:
                  subtasksDone === subtasksTotal
                    ? 'var(--success)'
                    : 'var(--accent)',
              }}
            />
          </div>
          <span
            className="text-xs shrink-0 tabular-nums"
            style={{
              color:
                subtasksDone === subtasksTotal
                  ? 'var(--success)'
                  : 'var(--muted)',
            }}
          >
            {subtasksDone}/{subtasksTotal}
          </span>
        </div>
      )}
    </div>
  )
})
