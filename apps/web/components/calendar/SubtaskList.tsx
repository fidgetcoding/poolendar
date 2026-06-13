'use client'

import * as React from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubtaskItem {
  id: string
  title: string
  completed: boolean
  time_estimate_minutes: number | null
}

interface SubtaskListProps {
  subtasks: SubtaskItem[]
  onChange: (subtasks: SubtaskItem[]) => void
}

function generateId(): string {
  return `st-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseTimeEstimate(input: string): number | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  const hourMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:r|rs|our|ours)?$/)
  if (hourMatch) return Math.round(parseFloat(hourMatch[1]!) * 60)

  const minMatch = trimmed.match(/^(\d+)\s*m(?:in|ins|inute|inutes)?$/)
  if (minMatch) return parseInt(minMatch[1]!, 10)

  const numOnly = parseInt(trimmed, 10)
  if (!isNaN(numOnly) && numOnly > 0) return numOnly

  return null
}

function formatTimeEstimate(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  return `${minutes}m`
}

interface SortableSubtaskRowProps {
  subtask: SubtaskItem
  onToggle: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onEstimateChange: (id: string, value: string) => void
  onDelete: (id: string) => void
}

function SortableSubtaskRow({
  subtask,
  onToggle,
  onTitleChange,
  onEstimateChange,
  onDelete,
}: SortableSubtaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const [localEstimate, setLocalEstimate] = React.useState(
    formatTimeEstimate(subtask.time_estimate_minutes)
  )

  React.useEffect(() => {
    setLocalEstimate(formatTimeEstimate(subtask.time_estimate_minutes))
  }, [subtask.time_estimate_minutes])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md group',
        'bg-[var(--bg)] border border-[var(--border)]',
        'transition-shadow duration-150',
        isDragging && 'shadow-lg shadow-black/30 border-[var(--accent)]'
      )}
    >
      <button
        type="button"
        className={cn(
          'flex items-center justify-center shrink-0',
          'text-[var(--muted)] hover:text-[var(--fg)]',
          'cursor-grab active:cursor-grabbing',
          'transition-colors duration-150'
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      <label className="flex items-center shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={subtask.completed}
          onChange={() => onToggle(subtask.id)}
          className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
        />
      </label>

      <input
        type="text"
        value={subtask.title}
        onChange={(e) => onTitleChange(subtask.id, e.target.value)}
        placeholder="Subtask title"
        className={cn(
          'flex-1 min-w-0 bg-transparent text-sm',
          'text-[var(--fg)] placeholder:text-[var(--muted)]',
          'focus:outline-none',
          subtask.completed && 'line-through text-[var(--muted)]'
        )}
      />

      <input
        type="text"
        value={localEstimate}
        onChange={(e) => setLocalEstimate(e.target.value)}
        onBlur={(e) => onEstimateChange(subtask.id, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onEstimateChange(subtask.id, localEstimate)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="Est."
        className={cn(
          'w-14 px-1.5 py-0.5 text-xs text-center rounded',
          'bg-[var(--surface)] border border-[var(--border)]',
          'text-[var(--muted)] placeholder:text-[var(--muted)]',
          'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
          'focus:text-[var(--fg)]'
        )}
      />

      <button
        type="button"
        onClick={() => onDelete(subtask.id)}
        className={cn(
          'flex items-center justify-center w-5 h-5 shrink-0 rounded',
          'text-[var(--muted)] opacity-0 group-hover:opacity-100',
          'hover:text-[var(--destructive)]',
          'transition-all duration-150'
        )}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function SubtaskList({ subtasks, onChange }: SubtaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  )

  const completedCount = subtasks.filter((s) => s.completed).length
  const totalCount = subtasks.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = subtasks.findIndex((s) => s.id === active.id)
    const newIndex = subtasks.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    onChange(arrayMove(subtasks, oldIndex, newIndex))
  }

  function toggleSubtask(id: string) {
    onChange(
      subtasks.map((s) =>
        s.id === id ? { ...s, completed: !s.completed } : s
      )
    )
  }

  function updateTitle(id: string, title: string) {
    onChange(
      subtasks.map((s) => (s.id === id ? { ...s, title } : s))
    )
  }

  function updateEstimate(id: string, value: string) {
    const minutes = parseTimeEstimate(value)
    onChange(
      subtasks.map((s) =>
        s.id === id ? { ...s, time_estimate_minutes: minutes } : s
      )
    )
  }

  function deleteSubtask(id: string) {
    onChange(subtasks.filter((s) => s.id !== id))
  }

  function addSubtask() {
    onChange([
      ...subtasks,
      {
        id: generateId(),
        title: '',
        completed: false,
        time_estimate_minutes: null,
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--fg)]">Subtasks</span>
        {totalCount > 0 && (
          <span className="text-xs text-[var(--muted)]">
            {completedCount}/{totalCount} complete
          </span>
        )}
      </div>

      {totalCount > 0 && (
        <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5">
            {subtasks.map((subtask) => (
              <SortableSubtaskRow
                key={subtask.id}
                subtask={subtask}
                onToggle={toggleSubtask}
                onTitleChange={updateTitle}
                onEstimateChange={updateEstimate}
                onDelete={deleteSubtask}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addSubtask}
        className={cn(
          'flex items-center gap-1.5 w-full px-3 py-2 rounded-md',
          'text-sm text-[var(--muted)] hover:text-[var(--fg)]',
          'border border-dashed border-[var(--border)]',
          'hover:border-[var(--accent)]',
          'transition-colors duration-150'
        )}
      >
        <Plus size={14} />
        <span>Add subtask</span>
      </button>
    </div>
  )
}
