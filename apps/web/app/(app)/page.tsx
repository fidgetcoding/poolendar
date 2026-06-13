'use client'

import { useMemo, useCallback } from 'react'
import { parseISO } from 'date-fns'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { CalendarHeader, CalendarGrid } from '@/components/calendar'
import { KanbanBoard } from '@/components/kanban'
import type { TaskStatus, TaskBoard, TaskImportance } from '@poolendar/types'

export default function AppPage() {
  const {
    view,
    selectedDate,
    hourHeight,
    goToToday,
    goToPrevPeriod,
    goToNextPeriod,
    setView,
  } = useCalendarStore()

  const { taskPanelViewMode, openEditForm } = useUIStore()

  const currentDate = useMemo(
    () => parseISO(selectedDate + 'T00:00:00'),
    [selectedDate]
  )

  // Calendar view mode mapped for CalendarHeader
  const headerView = view === '2weeks' || view === 'custom' ? 'week' : view

  // Placeholder data arrays — these will come from TanStack Query hooks
  // once the API layer is fully wired. The components accept typed arrays
  // and render empty states when the arrays are empty.
  const events: import('@poolendar/types').CalendarEvent[] = []
  const tasks: import('@poolendar/types').Task[] = []
  const routines: import('@poolendar/types').Routine[] = []
  const calendars: import('@poolendar/types').Calendar[] = []
  const tags: import('@poolendar/types').Tag[] = []

  // Calendar item interactions
  const handleItemClick = useCallback(
    (item: { id: string; type: 'event' | 'task' | 'routine' }) => {
      useCalendarStore.getState().selectItem(item.id, item.type)
    },
    []
  )

  const handleItemDoubleClick = useCallback(
    (item: { id: string; type: 'event' | 'task' | 'routine' }) => {
      openEditForm(item.id, item.type)
    },
    [openEditForm]
  )

  const handleTimeSlotClick = useCallback(
    (_date: Date, _time: Date) => {
      openEditForm(null, 'event')
    },
    [openEditForm]
  )

  // Kanban interactions
  const handleTaskMove = useCallback(
    (_taskId: string, _newStatus: TaskStatus, _newPosition: number) => {
      // Will call useTasks().moveTask()
    },
    []
  )

  const handleTaskReorder = useCallback(
    (_taskId: string, _status: TaskStatus, _newPosition: number) => {
      // Will call useTasks().reorderTask()
    },
    []
  )

  const handleTaskUpdate = useCallback(
    (_taskId: string, _updates: Partial<import('@poolendar/types').Task>) => {
      // Will call useTasks().updateTask()
    },
    []
  )

  const handleTaskCreate = useCallback(
    (_data: {
      title: string
      status: TaskStatus
      importance: TaskImportance
      due_date: string | null
      board: TaskBoard
    }) => {
      // Will call useTasks().createTask()
    },
    []
  )

  const handleTaskClick = useCallback(
    (task: import('@poolendar/types').Task) => {
      openEditForm(task.id, 'task')
    },
    [openEditForm]
  )

  const handleTaskComplete = useCallback(
    (_taskId: string) => {
      // Will call useTasks().completeTask()
    },
    []
  )

  const showKanban = taskPanelViewMode === 'board'

  return (
    <div className="flex h-full flex-col">
      {/* Top navigation bar */}
      <CalendarHeader
        currentDate={currentDate}
        view={headerView}
        onToday={goToToday}
        onPrev={goToPrevPeriod}
        onNext={goToNextPeriod}
        onViewChange={(v) => setView(v)}
      />

      {/* Main content area */}
      {showKanban ? (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            tasks={tasks}
            tags={tags}
            onTaskMove={handleTaskMove}
            onTaskReorder={handleTaskReorder}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
            onTaskClick={handleTaskClick}
            onTaskComplete={handleTaskComplete}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CalendarGrid
            view={headerView}
            currentDate={currentDate}
            events={events}
            tasks={tasks}
            routines={routines}
            calendars={calendars}
            hourHeight={hourHeight}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onTimeSlotClick={handleTimeSlotClick}
          />
        </div>
      )}
    </div>
  )
}
