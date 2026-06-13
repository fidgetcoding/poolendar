'use client'

import { useMemo, useCallback } from 'react'
import { parseISO, format } from 'date-fns'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { CalendarHeader, CalendarGrid } from '@/components/calendar'
import { KanbanBoard } from '@/components/kanban'
import {
  useCompleteRoutineInstance,
  useResetRoutineInstance,
} from '@/lib/hooks/use-routines'
import type { CalendarItemData } from '@/components/calendar/calendar-types'
import type { TaskStatus, TaskBoard, TaskImportance } from '@poolendar/types'

export default function AppPage() {
  const {
    view,
    customDays,
    selectedDate,
    hourHeight,
    showWeekends,
    dimPastEvents,
    showDeclinedEvents,
    showCompletedTasks,
    goToToday,
    goToPrevPeriod,
    goToNextPeriod,
    setView,
    setShowWeekends,
    setDimPastEvents,
    setShowDeclinedEvents,
    setShowCompletedTasks,
  } = useCalendarStore()

  const { taskPanelViewMode, openEditForm } = useUIStore()

  const currentDate = useMemo(
    () => parseISO(selectedDate + 'T00:00:00'),
    [selectedDate]
  )

  // Calendar view mode mapped for CalendarGrid (it only supports day/week/month)
  const gridView = view === '2weeks' || view === 'custom' ? 'week' : view

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

  // Routine instance completion toggle
  const completeRoutineInstance = useCompleteRoutineInstance()
  const resetRoutineInstance = useResetRoutineInstance()

  const handleRoutineCheckboxClick = useCallback(
    (item: CalendarItemData) => {
      if (!item.routine) return
      // Extract date from the composite id: `${routine.id}-${yyyy-MM-dd}`
      const dateStr = format(item.startTime, 'yyyy-MM-dd')
      if (item.routineInstanceStatus === 'completed') {
        resetRoutineInstance.mutate({ routine_id: item.routine.id, date: dateStr })
      } else {
        completeRoutineInstance.mutate({ routine_id: item.routine.id, date: dateStr })
      }
    },
    [completeRoutineInstance, resetRoutineInstance]
  )

  const showKanban = taskPanelViewMode === 'board'

  return (
    <div className="flex h-full flex-col">
      {/* Top navigation bar */}
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        customDays={customDays}
        onToday={goToToday}
        onPrev={goToPrevPeriod}
        onNext={goToNextPeriod}
        onViewChange={(v) => setView(v)}
        showWeekends={showWeekends}
        dimPastEvents={dimPastEvents}
        showDeclinedEvents={showDeclinedEvents}
        showCompletedTasks={showCompletedTasks}
        onShowWeekendsChange={setShowWeekends}
        onDimPastEventsChange={setDimPastEvents}
        onShowDeclinedEventsChange={setShowDeclinedEvents}
        onShowCompletedTasksChange={setShowCompletedTasks}
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
            view={gridView}
            currentDate={currentDate}
            events={events}
            tasks={tasks}
            routines={routines}
            calendars={calendars}
            hourHeight={hourHeight}
            onItemClick={handleItemClick}
            onItemDoubleClick={handleItemDoubleClick}
            onTimeSlotClick={handleTimeSlotClick}
            onRoutineCheckboxClick={handleRoutineCheckboxClick}
          />
        </div>
      )}
    </div>
  )
}
