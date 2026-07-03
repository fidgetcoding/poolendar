'use client'

import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Circle } from 'lucide-react'
import type { Task, TaskImportance } from '@poolendar/types'
import { isToday, isPast, format, parseISO } from 'date-fns'

const IMPORTANCE_COLORS: Record<TaskImportance, string> = {
  highest: '#ef4444',
  high: '#f97316',
  normal: 'var(--muted)',
  low: '#6b7280',
  lowest: '#4b5563',
}

interface TaskCardCompactProps {
  task: Task
  onTaskClick: (task: Task) => void
  onTaskComplete: (taskId: string) => void
}

export const TaskCardCompact = React.memo(function TaskCardCompact({
  task,
  onTaskClick,
  onTaskComplete,
}: TaskCardCompactProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isCompleted = task.status === 'done'

  function getDueDateColor(): string {
    if (!task.due_date) return 'var(--muted)'
    const date = parseISO(task.due_date)
    if (isPast(date) && !isToday(date)) return 'var(--destructive)'
    if (isToday(date)) return 'var(--accent)'
    return 'var(--muted)'
  }

  function formatDueDate(): string | null {
    if (!task.due_date) return null
    const date = parseISO(task.due_date)
    if (isToday(date)) return 'Today'
    return format(date, 'MMM d')
  }

  return (
    <div
      ref={setNodeRef}
      data-task-card
      data-task-id={task.id}
      style={{
        ...style,
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:border-[var(--accent)]/30 transition-colors duration-150"
      onClick={() => onTaskClick(task)}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="shrink-0"
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
            className="hover:text-[var(--accent)] transition-colors"
          />
        )}
      </button>

      <span
        className="text-sm truncate flex-1"
        style={{
          color: isCompleted ? 'var(--muted)' : 'var(--fg)',
          textDecoration: isCompleted ? 'line-through' : 'none',
        }}
      >
        {task.title}
      </span>

      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: IMPORTANCE_COLORS[task.importance] }}
      />

      {formatDueDate() && (
        <span
          className="text-xs shrink-0"
          style={{ color: getDueDateColor() }}
        >
          {formatDueDate()}
        </span>
      )}
    </div>
  )
})
