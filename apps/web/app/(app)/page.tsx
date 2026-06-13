'use client'

import { useMemo, useCallback } from 'react'
import { parseISO, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { CalendarHeader, CalendarGrid } from '@/components/calendar'
import { KanbanBoard } from '@/components/kanban'
import { useEvents } from '@/lib/hooks/use-events'
import { useTasks, useMoveTask, useCompleteTask, useCreateTask, useUpdateTask } from '@/lib/hooks/use-tasks'
import { useRoutines, useCompleteRoutineInstance, useResetRoutineInstance } from '@/lib/hooks/use-routines'
import { useTags } from '@/lib/hooks/use-tags'
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

  const gridView = view === '2weeks' || view === 'custom' ? 'week' : view

  const { start: viewStart, end: viewEnd } = useMemo(() => {
    const d = currentDate
    if (view === 'day') return { start: format(d, 'yyyy-MM-dd'), end: format(d, 'yyyy-MM-dd') }
    if (view === 'month') return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') }
    const ws = startOfWeek(d, { weekStartsOn: 0 })
    const days = view === '2weeks' ? 13 : view === 'custom' ? customDays - 1 : 6
    return { start: format(ws, 'yyyy-MM-dd'), end: format(addDays(ws, days), 'yyyy-MM-dd') }
  }, [currentDate, view, customDays])

  const { data: events = [] } = useEvents(viewStart, viewEnd)
  const { data: tasks = [] } = useTasks({})
  const { data: routines = [] } = useRoutines()
  const { data: tags = [] } = useTags()
  const calendars: import('@poolendar/types').Calendar[] = []

  const moveTask = useMoveTask()
  const completeTask = useCompleteTask()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

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
    (taskId: string, newStatus: TaskStatus, newPosition: number) => {
      moveTask.mutate({ id: taskId, status: newStatus, position: newPosition })
    },
    [moveTask]
  )

  const handleTaskReorder = useCallback(
    (taskId: string, status: TaskStatus, newPosition: number) => {
      moveTask.mutate({ id: taskId, status, position: newPosition })
    },
    [moveTask]
  )

  const handleTaskUpdate = useCallback(
    (taskId: string, updates: Partial<import('@poolendar/types').Task>) => {
      updateTask.mutate({ id: taskId, data: updates })
    },
    [updateTask]
  )

  const handleTaskCreate = useCallback(
    (data: {
      title: string
      status: TaskStatus
      importance: TaskImportance
      due_date: string | null
      board: TaskBoard
    }) => {
      createTask.mutate(data as Parameters<typeof createTask.mutate>[0])
    },
    [createTask]
  )

  const handleTaskClick = useCallback(
    (task: import('@poolendar/types').Task) => {
      openEditForm(task.id, 'task')
    },
    [openEditForm]
  )

  const handleTaskComplete = useCallback(
    (taskId: string) => {
      completeTask.mutate(taskId)
    },
    [completeTask]
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
