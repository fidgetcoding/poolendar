'use client'

import * as React from 'react'
import { format } from 'date-fns'
import type {
  CalendarEvent,
  Task,
  Routine,
  Calendar,
  Tag,
} from '@poolendar/types'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useCalendarContextActions } from '@/lib/hooks/use-calendar-context-actions'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from '@/lib/hooks/use-events'
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  useMoveTask,
  useScheduleTask,
} from '@/lib/hooks/use-tasks'
import {
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useCompleteRoutineInstance,
  useResetRoutineInstance,
  useSkipRoutineInstance,
} from '@/lib/hooks/use-routines'
import { CalendarGrid } from './CalendarGrid'
import { PreviewPopover } from './PreviewPopover'
import { ContextMenu } from './ContextMenu'
import type { CalendarItemData, CalendarItemType } from './calendar-types'
import { parseRoutineItemId } from './grid-helpers'

interface CalendarWorkspaceProps {
  events: CalendarEvent[]
  tasks: Task[]
  routines: Routine[]
  calendars: Calendar[]
  tags: Tag[]
  selfEmails: string[]
  userId: string | null
  currentDate: Date
}

function twoDigit(n: number): string {
  return String(n).padStart(2, '0')
}
function toTimeString(d: Date): string {
  return `${twoDigit(d.getHours())}:${twoDigit(d.getMinutes())}`
}

export function CalendarWorkspace({
  events,
  tasks,
  routines,
  calendars,
  tags,
  selfEmails,
  userId,
  currentDate,
}: CalendarWorkspaceProps) {
  const store = useCalendarStore()
  const { openEditForm } = useUIStore()

  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()
  const moveTask = useMoveTask()
  const scheduleTask = useScheduleTask()
  const createRoutine = useCreateRoutine()
  const updateRoutine = useUpdateRoutine()
  const deleteRoutine = useDeleteRoutine()
  const completeRoutineInstance = useCompleteRoutineInstance()
  const resetRoutineInstance = useResetRoutineInstance()
  const skipRoutineInstance = useSkipRoutineInstance()

  const ctx = useCalendarContextActions({
    events,
    tasks,
    routines,
    calendars,
    userId,
    currentDate,
  })

  const [preview, setPreview] = React.useState<{
    item: {
      type: CalendarItemType
      event?: CalendarEvent
      task?: Task
      routine?: Routine
      calendarName?: string
      calendarColor?: string
    }
    source: CalendarItemData
    anchorRect: DOMRect | null
  } | null>(null)

  const defaultCalendarId = calendars.find((c) => c.is_primary)?.id ?? calendars[0]?.id ?? null

  // ---- helpers ----
  function routineDateOf(item: CalendarItemData): string {
    return format(item.startTime, 'yyyy-MM-dd')
  }

  function createRoutineRow(
    over: Partial<Routine> & { title: string }
  ) {
    if (!userId) return
    createRoutine.mutate({
      user_id: userId,
      calendar_id: over.calendar_id ?? defaultCalendarId,
      title: over.title,
      notes: over.notes ?? null,
      start_time: over.start_time ?? '09:00',
      end_time: over.end_time ?? '10:00',
      timezone: over.timezone ?? 'America/New_York',
      recurrence_rule: over.recurrence_rule ?? 'FREQ=DAILY',
      location: over.location ?? null,
      visibility: over.visibility ?? 'busy',
      privacy: over.privacy ?? 'private',
      reminders: over.reminders ?? [],
    } as unknown as Parameters<typeof createRoutine.mutate>[0])
  }

  // ---- grid interactions (#14) ----
  function handleReschedule(
    itemId: string,
    itemType: CalendarItemType,
    newStart: Date,
    newEnd: Date
  ) {
    if (itemType === 'event') {
      updateEvent.mutate({
        id: itemId,
        data: {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
          sync_status: 'pending_push',
        },
      })
    } else if (itemType === 'task') {
      scheduleTask.mutate({
        id: itemId,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
      })
    } else {
      const { routineId } = parseRoutineItemId(itemId)
      updateRoutine.mutate({
        id: routineId,
        data: { start_time: toTimeString(newStart), end_time: toTimeString(newEnd) },
      })
    }
  }

  function handleResize(itemId: string, itemType: CalendarItemType, newEnd: Date) {
    if (itemType === 'event') {
      updateEvent.mutate({
        id: itemId,
        data: { end_time: newEnd.toISOString(), sync_status: 'pending_push' },
      })
    } else if (itemType === 'task') {
      updateTask.mutate({ id: itemId, data: { scheduled_end: newEnd.toISOString() } })
    } else {
      const { routineId } = parseRoutineItemId(itemId)
      updateRoutine.mutate({ id: routineId, data: { end_time: toTimeString(newEnd) } })
    }
  }

  function handleQuickCreate(
    title: string,
    type: CalendarItemType,
    startTime: Date,
    endTime?: Date
  ) {
    if (!userId) return
    const end = endTime ?? new Date(startTime.getTime() + store.defaultTaskDuration * 60000)

    if (type === 'event') {
      if (!defaultCalendarId) {
        // No calendar to attach the event to — open the full form instead.
        openEditForm(null, 'event', 'event', {
          title,
          start_time: startTime.toISOString(),
          end_time: end.toISOString(),
        })
        return
      }
      createEvent.mutate({
        user_id: userId,
        calendar_id: defaultCalendarId,
        google_event_id: null,
        title,
        notes: null,
        start_time: startTime.toISOString(),
        end_time: end.toISOString(),
        timezone: 'America/New_York',
        is_all_day: false,
        location: null,
        color_override: null,
        visibility: 'busy',
        privacy: 'public',
        conferencing_url: null,
        recurrence_rule: null,
        recurrence_id: null,
        attendees: [],
        reminders: [],
        status: 'confirmed',
        sync_status: 'pending_push',
        etag: null,
      })
    } else if (type === 'task') {
      createTask.mutate({
        user_id: userId,
        calendar_id: defaultCalendarId,
        parent_id: null,
        title,
        notes: null,
        importance: 'normal',
        time_estimate_minutes: null,
        earliest_start: null,
        due_date: null,
        due_date_recurrence: null,
        scheduled_start: startTime.toISOString(),
        scheduled_end: end.toISOString(),
        location: null,
        visibility: 'busy',
        privacy: 'private',
        flexibility: 'flexible',
        status: 'backlog',
        board: 'current',
        is_split: false,
        completed_at: null,
        position: null,
        reminders: [],
      })
    } else {
      createRoutineRow({
        title,
        start_time: toTimeString(startTime),
        end_time: toTimeString(end),
      })
    }
  }

  function handleOpenFullForm(
    type: CalendarItemType,
    date: Date,
    startTime: Date,
    endTime?: Date
  ) {
    const end = endTime ?? new Date(startTime.getTime() + store.defaultTaskDuration * 60000)
    if (type === 'event') {
      openEditForm(null, 'event', 'event', {
        start_time: startTime.toISOString(),
        end_time: end.toISOString(),
        calendar_id: defaultCalendarId,
      })
    } else if (type === 'task') {
      openEditForm(null, 'task', 'task', {
        scheduled_start: startTime.toISOString(),
        scheduled_end: end.toISOString(),
      })
    } else {
      openEditForm(null, 'routine', 'routine', {
        start_time: toTimeString(startTime),
        end_time: toTimeString(end),
      })
    }
  }

  // ---- single click: preview (#15) ----
  function handleItemClick(item: CalendarItemData, anchorRect?: DOMRect) {
    const calId =
      item.event?.calendar_id ?? item.task?.calendar_id ?? item.routine?.calendar_id ?? null
    const cal = calId ? calendars.find((c) => c.id === calId) : undefined
    setPreview({
      item: {
        type: item.type,
        event: item.event,
        task: item.task,
        routine: item.routine,
        calendarName: cal?.name,
        calendarColor: item.color,
      },
      source: item,
      anchorRect: anchorRect ?? null,
    })
  }

  function handleItemDoubleClick(item: CalendarItemData) {
    setPreview(null)
    openEditForm(item.id, item.type)
  }

  function handleTaskCheckbox(item: CalendarItemData) {
    if (!item.task) return
    if (item.task.status === 'done') {
      moveTask.mutate({ id: item.task.id, status: 'backlog' })
    } else {
      completeTask.mutate(item.task.id)
    }
  }

  function handleRoutineCheckbox(item: CalendarItemData) {
    if (!item.routine) return
    const date = routineDateOf(item)
    if (item.routineInstanceStatus === 'completed') {
      // Toggling off a completed instance reverts it to pending.
      resetRoutineInstance.mutate({ routine_id: item.routine.id, date })
    } else {
      completeRoutineInstance.mutate({ routine_id: item.routine.id, date })
    }
  }

  // ---- preview actions ----
  function deleteBySource(source: CalendarItemData) {
    if (source.type === 'event') deleteEvent.mutate(source.id)
    else if (source.type === 'task') deleteTask.mutate(source.id)
    else deleteRoutine.mutate(parseRoutineItemId(source.id).routineId)
  }

  return (
    <>
      <CalendarGrid
        view={store.view}
        currentDate={currentDate}
        customDays={store.customDays}
        events={events}
        tasks={tasks}
        routines={routines}
        calendars={calendars}
        hourHeight={store.hourHeight}
        startHour={store.timeGridStart}
        endHour={store.timeGridEnd}
        draggingResolution={store.timeDraggingResolution}
        limitPerDay={store.limitEventsPerDay}
        widenCurrentDay={store.widenCurrentDay}
        dimPastEvents={store.dimPastEvents}
        showWeekends={store.showWeekends}
        showCompletedTasks={store.showCompletedTasks}
        showDeclinedEvents={store.showDeclinedEvents}
        mergeDuplicateEvents={store.mergeDuplicateEvents}
        showWeekNumbers
        selfEmails={selfEmails}
        onItemClick={handleItemClick}
        onItemDoubleClick={handleItemDoubleClick}
        onItemReschedule={handleReschedule}
        onItemResize={handleResize}
        onQuickCreate={handleQuickCreate}
        onOpenFullForm={handleOpenFullForm}
        onRoutineCheckboxClick={handleRoutineCheckbox}
        onTaskCheckboxClick={handleTaskCheckbox}
      />

      {preview && (
        <PreviewPopover
          item={preview.item}
          anchorRect={preview.anchorRect}
          onClose={() => setPreview(null)}
          onEdit={() => {
            const src = preview.source
            setPreview(null)
            openEditForm(src.id, src.type)
          }}
          onDelete={() => {
            deleteBySource(preview.source)
            setPreview(null)
          }}
          onComplete={() => {
            const src = preview.source
            if (src.type === 'task' && src.task) completeTask.mutate(src.task.id)
            else if (src.type === 'routine' && src.routine)
              completeRoutineInstance.mutate({
                routine_id: src.routine.id,
                date: routineDateOf(src),
              })
            setPreview(null)
          }}
          onSkip={() => {
            const src = preview.source
            if (src.routine)
              skipRoutineInstance.mutate({
                routine_id: src.routine.id,
                date: routineDateOf(src),
              })
            setPreview(null)
          }}
        />
      )}

      <ContextMenu
        item={ctx.ctxItem}
        onEdit={ctx.onEdit}
        onDelete={ctx.onDelete}
        onDuplicate={ctx.onDuplicate}
        onComplete={ctx.onComplete}
        onSkip={ctx.onSkip}
        onConvert={ctx.onConvert}
        onSplit={ctx.onSplit}
        onColorOverride={ctx.onColorOverride}
        onJoin={ctx.onJoin}
        onCopyMeetingLink={ctx.onCopyMeetingLink}
        onEmailAttendees={ctx.onEmailAttendees}
        onCreate={ctx.onCreate}
      />
    </>
  )
}
