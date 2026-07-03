'use client'

import { useMemo, useCallback } from 'react'
import { parseISO, format, addDays } from 'date-fns'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { CalendarHeader } from '@/components/calendar'
import { CalendarWorkspace } from '@/components/calendar/CalendarWorkspace'
import { EditFormHost } from '@/components/calendar/EditFormHost'
import { getVisibleDays } from '@/components/calendar/grid-helpers'
import { KanbanBoard } from '@/components/kanban'
import { useEvents } from '@/lib/hooks/use-events'
import { useTasks, useMoveTask, useCompleteTask, useCreateTask, useUpdateTask } from '@/lib/hooks/use-tasks'
import { useRoutines } from '@/lib/hooks/use-routines'
import { useTags } from '@/lib/hooks/use-tags'
import { useCalendars, useCalendarAccounts } from '@/lib/hooks/use-calendars'
import { useProfile } from '@/lib/hooks/use-profile'
import type { TaskStatus, TaskBoard, TaskImportance } from '@poolendar/types'

export default function AppPage() {
  const {
    view,
    customDays,
    selectedDate,
    showWeekends,
    widenCurrentDay,
    dimPastEvents,
    showDeclinedEvents,
    showCompletedTasks,
    mergeDuplicateEvents,
    goToToday,
    goToPrevPeriod,
    goToNextPeriod,
    setView,
    setShowWeekends,
    setWidenCurrentDay,
    setDimPastEvents,
    setShowDeclinedEvents,
    setShowCompletedTasks,
    setMergeDuplicateEvents,
  } = useCalendarStore()

  const { taskPanelViewMode } = useUIStore()

  const currentDate = useMemo(
    () => parseISO(selectedDate + 'T00:00:00'),
    [selectedDate]
  )

  // Range covering every visible day of the current view (2-weeks / custom
  // included), padded to the end of the last day.
  const { start: viewStart, end: viewEnd } = useMemo(() => {
    const days = getVisibleDays(currentDate, view, customDays)
    const first = days[0] ?? currentDate
    const last = days[days.length - 1] ?? currentDate
    return {
      start: format(first, 'yyyy-MM-dd'),
      end: format(addDays(last, 1), 'yyyy-MM-dd'),
    }
  }, [currentDate, view, customDays])

  const { data: events = [] } = useEvents(viewStart, viewEnd)
  const { data: tasks = [] } = useTasks({})
  const { data: routines = [] } = useRoutines()
  const { data: tags = [] } = useTags()
  const { data: calendars = [] } = useCalendars()
  const { data: accounts = [] } = useCalendarAccounts()
  const { data: profile } = useProfile()

  const userId = profile?.id ?? null
  const selfEmails = useMemo(() => accounts.map((a) => a.email), [accounts])

  const moveTask = useMoveTask()
  const completeTask = useCompleteTask()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  // ---- Kanban interactions ----
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

  const { openEditForm } = useUIStore()
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

  const showKanban = taskPanelViewMode === 'board'

  return (
    <div className="flex h-full flex-col">
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        customDays={customDays}
        onToday={goToToday}
        onPrev={goToPrevPeriod}
        onNext={goToNextPeriod}
        onViewChange={(v) => setView(v)}
        showWeekends={showWeekends}
        widenCurrentDay={widenCurrentDay}
        dimPastEvents={dimPastEvents}
        showDeclinedEvents={showDeclinedEvents}
        showCompletedTasks={showCompletedTasks}
        mergeDuplicateEvents={mergeDuplicateEvents}
        onShowWeekendsChange={setShowWeekends}
        onWidenCurrentDayChange={setWidenCurrentDay}
        onDimPastEventsChange={setDimPastEvents}
        onShowDeclinedEventsChange={setShowDeclinedEvents}
        onShowCompletedTasksChange={setShowCompletedTasks}
        onMergeDuplicateEventsChange={setMergeDuplicateEvents}
      />

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
          <CalendarWorkspace
            events={events}
            tasks={tasks}
            routines={routines}
            calendars={calendars}
            tags={tags}
            selfEmails={selfEmails}
            userId={userId}
            currentDate={currentDate}
          />
        </div>
      )}

      {/* Globally-mounted edit form — opens from grid, kanban, keyboard, or menus */}
      <EditFormHost
        events={events}
        tasks={tasks}
        routines={routines}
        calendars={calendars}
        tags={tags}
        userId={userId}
      />
    </div>
  )
}
