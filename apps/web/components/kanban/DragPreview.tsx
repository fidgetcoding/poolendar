'use client'

import type { Task } from '@poolendar/types'
import { TaskCard } from './TaskCard'

interface DragPreviewProps {
  task: Task
}

export function DragPreview({ task }: DragPreviewProps) {
  return (
    <div
      style={{
        transform: 'rotate(2.5deg)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45), 0 4px 12px rgba(0, 0, 0, 0.3)',
        opacity: 0.92,
        cursor: 'grabbing',
        maxWidth: 320,
        pointerEvents: 'none',
      }}
    >
      <TaskCard
        task={task}
        onTaskClick={() => {}}
        onTaskComplete={() => {}}
        isDragOverlay
      />
    </div>
  )
}
