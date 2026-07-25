'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { Task, TaskStatus, TaskImportance } from '@poolendar/types'
import { TaskCard } from './TaskCard'
import { TaskCardCompact } from './TaskCardCompact'
import { EmptyColumn } from './EmptyColumn'
import { QuickAddTask } from './QuickAddTask'

const COLUMN_TITLES: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  check: 'Check',
  done: 'Done',
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  backlog: 'var(--muted)',
  in_progress: 'var(--accent)',
  check: '#3b82f6',
  done: 'var(--success)',
}

const COMPACT_THRESHOLD = 10

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  parentTitles: Record<string, string>
  onTaskClick: (task: Task) => void
  onTaskComplete: (taskId: string) => void
  onCreateTask: (data: {
    title: string
    status: TaskStatus
    importance: TaskImportance
    due_date: string | null
  }) => void
}

export function KanbanColumn({
  status,
  tasks,
  parentTitles,
  onTaskClick,
  onTaskComplete,
  onCreateTask,
}: KanbanColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [headerAddOpen, setHeaderAddOpen] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status },
  })

  const useCompact = tasks.length > COMPACT_THRESHOLD
  const taskIds = tasks.map((t) => t.id)
  const accentColor = COLUMN_ACCENT[status]

  return (
    <div
      data-kanban-column={status}
      className="flex flex-col min-w-[85vw] md:min-w-[280px] max-w-none md:max-w-[340px] w-full shrink-0 snap-center rounded-xl transition-colors duration-200"
      style={{
        backgroundColor: isOver
          ? 'rgba(249, 168, 37, 0.04)'
          : 'var(--surface-translucent)',
        border: isOver
          ? '1px solid rgba(249, 168, 37, 0.2)'
          : '1px solid transparent',
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 group"
        >
          {isCollapsed ? (
            <ChevronRight
              size={14}
              style={{ color: 'var(--muted)' }}
              className="group-hover:text-[color:var(--fg)] transition-colors"
            />
          ) : (
            <ChevronDown
              size={14}
              style={{ color: 'var(--muted)' }}
              className="group-hover:text-[color:var(--fg)] transition-colors"
            />
          )}

          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--fg)' }}
          >
            {COLUMN_TITLES[status]}
          </span>

          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }}
          >
            {tasks.length}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* Column-header add (#42) — creates a task pre-assigned to this column */}
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false)
              setHeaderAddOpen(true)
            }}
            aria-label={`Add task to ${COLUMN_TITLES[status]}`}
            title={`Add task to ${COLUMN_TITLES[status]}`}
            className="flex items-center justify-center w-6 h-6 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Plus size={14} />
          </button>

          {/* Column accent bar */}
          <div
            className="w-8 h-0.5 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Collapse/expand content */}
      {!isCollapsed && (
        <div
          ref={setNodeRef}
          className="flex-1 px-2 pb-3 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 200px)' }}
        >
          {headerAddOpen && (
            <div className="mb-2">
              <QuickAddTask
                status={status}
                onCreateTask={onCreateTask}
                startOpen
                onClose={() => setHeaderAddOpen(false)}
              />
            </div>
          )}

          <SortableContext
            items={taskIds}
            strategy={verticalListSortingStrategy}
          >
            {tasks.length === 0 ? (
              <EmptyColumn status={status} />
            ) : (
              <div className="flex flex-col gap-2">
                {tasks.map((task) =>
                  useCompact ? (
                    <TaskCardCompact
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      onTaskComplete={onTaskComplete}
                    />
                  ) : (
                    <TaskCard
                      key={task.id}
                      task={task}
                      parentTitle={
                        task.parent_id
                          ? parentTitles[task.parent_id]
                          : undefined
                      }
                      onTaskClick={onTaskClick}
                      onTaskComplete={onTaskComplete}
                    />
                  )
                )}
              </div>
            )}
          </SortableContext>

          {/* Quick add at column bottom */}
          <div className="mt-2">
            <QuickAddTask status={status} onCreateTask={onCreateTask} />
          </div>
        </div>
      )}
    </div>
  )
}
