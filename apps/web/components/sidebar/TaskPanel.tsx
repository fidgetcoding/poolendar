'use client'

import * as React from 'react'
import {
  isToday,
  isTomorrow,
  isBefore,
  isAfter,
  startOfDay,
  addDays,
  endOfDay,
  format,
} from 'date-fns'
import { useDraggable } from '@dnd-kit/core'
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  AlertCircle,
  Inbox,
  Search,
  Plus,
  Repeat2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useMoveTask } from '@/lib/hooks/use-tasks'
import { useUIStore } from '@/lib/stores/ui-store'
import { RoutinesPanel } from './RoutinesPanel'
import type { Task } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaskPanelProps {
  /** Optional override — when omitted the panel fetches its own data via useTasks() */
  tasks?: Task[]
  onTaskClick?: (taskId: string) => void
  onTaskComplete?: (taskId: string) => void
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string
  count: number
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  accentColor?: string
}

function Section({
  title,
  count,
  icon,
  children,
  defaultOpen = true,
  accentColor,
}: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  if (count === 0) return null

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-1.5 text-sm font-medium',
          'hover:bg-[var(--surface-hover)] rounded',
          'transition-colors duration-150'
        )}
        style={{ color: accentColor || 'var(--fg)' }}
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0" />
        ) : (
          <ChevronRight size={14} className="shrink-0" />
        )}
        {icon}
        <span className="truncate">{title}</span>
        <span
          className="ml-auto text-xs tabular-nums"
          style={{ color: 'var(--muted)' }}
        >
          {count}
        </span>
      </button>
      {open && <div className="pl-1">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Importance colors
// ---------------------------------------------------------------------------

const IMPORTANCE_COLORS: Record<string, string> = {
  highest: '#ef4444',
  high: '#f97316',
  normal: '#eab308',
  low: '#3b82f6',
  lowest: '#6b7280',
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: Task
  onTaskClick: (id: string) => void
  onTaskComplete: (id: string) => void
}

function TaskRow({ task, onTaskClick, onTaskComplete }: TaskRowProps) {
  const color = IMPORTANCE_COLORS[task.importance] || 'var(--muted)'
  const isDone = task.status === 'done'
  const subtasks = task.subtasks ?? []
  const completedSubtasks = subtasks.filter((s) => s.completed).length

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `sidebar-task-${task.id}`,
      data: { type: 'sidebar-task', task },
    })

  const dragStyle: React.CSSProperties = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        zIndex: 1000,
      }
    : undefined as unknown as React.CSSProperties

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 text-sm cursor-grab',
        'hover:bg-[var(--surface-hover)] rounded',
        'transition-colors duration-150 group',
        isDragging && 'opacity-50'
      )}
      onClick={() => onTaskClick(task.id)}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTaskClick(task.id)
        }
      }}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTaskComplete(task.id)
        }}
        className={cn(
          'shrink-0 w-4 h-4 rounded border flex items-center justify-center',
          'transition-colors duration-150',
          'hover:border-[var(--accent)]'
        )}
        style={{ borderColor: isDone ? 'var(--accent)' : 'var(--border)' }}
        aria-label={isDone ? 'Reopen task' : 'Complete task'}
      >
        {isDone && (
          <CheckSquare
            size={12}
            style={{ color: 'var(--accent)' }}
          />
        )}
      </button>

      {/* Importance dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      {/* Title + subtask info */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'block truncate',
            isDone && 'text-[var(--muted)] line-through'
          )}
          style={{ color: isDone ? undefined : 'var(--fg)' }}
        >
          {task.title}
        </span>

        {subtasks.length > 0 && (
          <span className="text-[10px] text-[var(--muted)]">
            {completedSubtasks}/{subtasks.length} subtasks
          </span>
        )}
      </div>

      {/* Due date badge */}
      {task.due_date && (
        <span className="text-[10px] text-[var(--muted)] shrink-0">
          {format(new Date(task.due_date), 'MMM d')}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskPanel
// ---------------------------------------------------------------------------

export function TaskPanel({
  tasks: tasksProp,
  onTaskClick: onTaskClickProp,
  onTaskComplete: onTaskCompleteProp,
}: TaskPanelProps) {
  const { data: fetchedTasks } = useTasks()
  const moveTask = useMoveTask()
  const uiStore = useUIStore()

  const [searchQuery, setSearchQuery] = React.useState('')

  const tasks = tasksProp ?? fetchedTasks ?? []

  const handleTaskClick = React.useCallback(
    (id: string) => {
      if (onTaskClickProp) {
        onTaskClickProp(id)
      } else {
        uiStore.openEditForm(id, 'task')
      }
    },
    [onTaskClickProp, uiStore]
  )

  const handleTaskComplete = React.useCallback(
    (id: string) => {
      if (onTaskCompleteProp) {
        onTaskCompleteProp(id)
      } else {
        const task = tasks.find((t) => t.id === id)
        if (task) {
          moveTask.mutate({
            id,
            status: task.status === 'done' ? 'backlog' : 'done',
          })
        }
      }
    },
    [onTaskCompleteProp, tasks, moveTask]
  )

  const handleCreateTask = React.useCallback(() => {
    const mode = uiStore.taskPanelMode
    uiStore.openEditForm(null, mode === 'routines' ? 'routine' : 'task')
  }, [uiStore])

  const taskPanelMode = uiStore.taskPanelMode

  // When in routines mode, render RoutinesPanel instead
  if (taskPanelMode === 'routines') {
    return (
      <div
        className="h-full overflow-y-auto flex flex-col"
        style={{
          backgroundColor: 'var(--bg)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Mode toggle tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => uiStore.setTaskPanelMode('tasks')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
              'transition-colors duration-150',
              'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
            )}
          >
            <CheckSquare size={12} />
            Tasks
          </button>
          <button
            type="button"
            onClick={() => uiStore.setTaskPanelMode('routines')}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
              'transition-colors duration-150',
              'text-[var(--fg)] bg-[var(--surface-hover)]'
            )}
          >
            <Repeat2 size={12} />
            Routines
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <RoutinesPanel />
        </div>
      </div>
    )
  }

  const now = new Date()
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(today, 7)

  // Filter by search query first
  const filteredTasks = React.useMemo(() => {
    if (!searchQuery.trim()) return tasks
    const q = searchQuery.toLowerCase()
    return tasks.filter((t) => t.title.toLowerCase().includes(q))
  }, [tasks, searchQuery])

  const activeTasks = filteredTasks.filter((t) => t.status !== 'done')

  const overdue = activeTasks.filter(
    (t) => t.due_date && isBefore(new Date(t.due_date), today)
  )

  const dueToday = activeTasks.filter(
    (t) => t.due_date && isToday(new Date(t.due_date))
  )

  const dueTomorrow = activeTasks.filter(
    (t) => t.due_date && isTomorrow(new Date(t.due_date))
  )

  const dueThisWeek = activeTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return isAfter(d, endOfDay(tomorrow)) && isBefore(d, weekEnd)
  })

  const inbox = activeTasks.filter(
    (t) => !t.due_date && t.status === 'backlog'
  )

  const totalActive =
    overdue.length +
    dueToday.length +
    dueTomorrow.length +
    dueThisWeek.length +
    inbox.length

  return (
    <div
      className="h-full overflow-y-auto flex flex-col"
      style={{
        backgroundColor: 'var(--bg)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Mode toggle tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 shrink-0">
        <button
          type="button"
          onClick={() => uiStore.setTaskPanelMode('tasks')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            'transition-colors duration-150',
            'text-[var(--fg)] bg-[var(--surface-hover)]'
          )}
        >
          <CheckSquare size={12} />
          Tasks
        </button>
        <button
          type="button"
          onClick={() => uiStore.setTaskPanelMode('routines')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            'transition-colors duration-150',
            'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
          )}
        >
          <Repeat2 size={12} />
          Routines
        </button>
      </div>

      {/* Header with title and add button */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--muted)' }}
        >
          Tasks
          {totalActive > 0 && (
            <span className="ml-1.5 tabular-nums">({totalActive})</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCreateTask}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded',
            'text-[var(--muted)] hover:text-[var(--fg)]',
            'hover:bg-[var(--surface-hover)] transition-colors duration-150'
          )}
          aria-label="Create task"
          title="Create task"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Search input */}
      <div className="px-3 pb-2 shrink-0">
        <div
          className="flex items-center gap-2 px-2 py-1 rounded"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <Search size={12} style={{ color: 'var(--muted)' }} className="shrink-0" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'flex-1 bg-transparent text-xs outline-none',
              'placeholder:text-[var(--muted)]'
            )}
            style={{ color: 'var(--fg)' }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <Section
          title="Overdue"
          count={overdue.length}
          icon={<AlertCircle size={14} className="shrink-0" />}
          accentColor="#ef4444"
        >
          {overdue.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
            />
          ))}
        </Section>

        <Section title="Today" count={dueToday.length}>
          {dueToday.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
            />
          ))}
        </Section>

        <Section title="Tomorrow" count={dueTomorrow.length}>
          {dueTomorrow.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
            />
          ))}
        </Section>

        <Section
          title="This Week"
          count={dueThisWeek.length}
          accentColor="#eab308"
          defaultOpen={false}
        >
          {dueThisWeek.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
            />
          ))}
        </Section>

        <Section
          title="Inbox"
          count={inbox.length}
          icon={<Inbox size={14} className="shrink-0" />}
          defaultOpen={false}
        >
          {inbox.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onTaskClick={handleTaskClick}
              onTaskComplete={handleTaskComplete}
            />
          ))}
        </Section>

        {totalActive === 0 && (
          <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">
            {searchQuery.trim() ? 'No matching tasks' : 'No tasks to show'}
          </div>
        )}
      </div>
    </div>
  )
}
