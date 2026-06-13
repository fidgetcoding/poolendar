'use client'

import { useDroppable } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import type { TaskStatus } from '@poolendar/types'

interface EmptyColumnProps {
  status: TaskStatus
}

export function EmptyColumn({ status }: EmptyColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}-empty`,
    data: { type: 'column', status },
  })

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col items-center justify-center py-12 px-4 rounded-lg transition-colors duration-200"
      style={{
        minHeight: 120,
        backgroundColor: isOver
          ? 'rgba(249, 168, 37, 0.06)'
          : 'transparent',
        border: isOver
          ? '2px dashed var(--accent)'
          : '2px dashed transparent',
      }}
    >
      <Inbox
        size={28}
        style={{ color: 'var(--muted)', opacity: 0.5 }}
      />
      <p
        className="text-xs mt-2 select-none"
        style={{ color: 'var(--muted)', opacity: 0.6 }}
      >
        No tasks
      </p>
    </div>
  )
}
