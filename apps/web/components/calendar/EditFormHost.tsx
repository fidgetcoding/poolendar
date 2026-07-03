'use client'

import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  CalendarEvent,
  Task,
  Routine,
  Calendar,
  Tag,
} from '@poolendar/types'
import { useUIStore } from '@/lib/stores/ui-store'
import { useTask } from '@/lib/hooks/use-tasks'
import {
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from '@/lib/hooks/use-events'
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from '@/lib/hooks/use-tasks'
import {
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
} from '@/lib/hooks/use-routines'
import { ItemEditForm, type ItemEditFormInitialData } from './ItemEditForm'
import type { RecurrenceEditScope } from './RecurrenceEditDialog'
import { parseRoutineItemId } from './grid-helpers'
import { buildConvertBody, convertRequirements, type ItemType } from '@/lib/convert'

interface EditFormHostProps {
  events: CalendarEvent[]
  tasks: Task[]
  routines: Routine[]
  calendars: Calendar[]
  tags: Tag[]
  userId: string | null
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['events'] })
  queryClient.invalidateQueries({ queryKey: ['tasks'] })
  queryClient.invalidateQueries({ queryKey: ['routines'] })
  queryClient.invalidateQueries({ queryKey: ['subtasks'] })
}

function eventInitialData(event: CalendarEvent): ItemEditFormInitialData {
  return {
    title: event.title,
    notes: event.notes ?? '',
    location: event.location,
    calendar_id: event.calendar_id,
    start_time: event.start_time,
    end_time: event.end_time,
    is_all_day: event.is_all_day,
    timezone: event.timezone,
    recurrence_rule: event.recurrence_rule,
    conferencing_url: event.conferencing_url,
    visibility: event.visibility,
    privacy: event.privacy,
    attendees: (event.attendees ?? []).map((a) => ({ email: a.email, name: a.name })),
    reminders: event.reminders ?? [],
  }
}

function taskInitialData(task: Task): ItemEditFormInitialData {
  return {
    title: task.title,
    notes: task.notes ?? '',
    location: task.location,
    calendar_id: task.calendar_id,
    scheduled_start: task.scheduled_start ?? undefined,
    scheduled_end: task.scheduled_end ?? undefined,
    importance: task.importance,
    time_estimate_minutes: task.time_estimate_minutes,
    due_date: task.due_date,
    earliest_start: task.earliest_start,
    flexibility: task.flexibility,
    visibility: task.visibility,
    privacy: task.privacy,
    reminders: task.reminders ?? [],
    subtasks: (task.subtasks ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      completed: s.completed,
      time_estimate_minutes: s.time_estimate_minutes,
    })),
    tags: task.tags ?? [],
  }
}

function routineInitialData(routine: Routine): ItemEditFormInitialData {
  return {
    title: routine.title,
    notes: routine.notes ?? '',
    location: routine.location,
    calendar_id: routine.calendar_id,
    start_time: routine.start_time,
    end_time: routine.end_time,
    timezone: routine.timezone,
    recurrence_rule: routine.recurrence_rule,
    visibility: routine.visibility,
    privacy: routine.privacy,
    reminders: routine.reminders ?? [],
  }
}

/**
 * Globally-mounted host that drives ItemEditForm from uiStore edit state.
 * Resolves the item being edited, provides calendars + tags, and routes Save to
 * the correct create / update / convert path (#13) and Split (#23d).
 */
export function EditFormHost({
  events,
  tasks,
  routines,
  calendars,
  tags,
  userId,
}: EditFormHostProps) {
  const queryClient = useQueryClient()
  const {
    editFormOpen,
    editFormItemId,
    editFormItemType,
    editFormTab,
    editFormInitialData,
    closeEditForm,
  } = useUIStore()

  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createRoutine = useCreateRoutine()
  const updateRoutine = useUpdateRoutine()
  const deleteRoutine = useDeleteRoutine()

  const isEdit = Boolean(editFormItemId)
  const isTaskEdit = isEdit && editFormItemType === 'task'
  // Fetch the full task (with subtasks + tags) for edit mode.
  const taskDetail = useTask(isTaskEdit && editFormItemId ? editFormItemId : '')

  const routineBaseId =
    editFormItemType === 'routine' && editFormItemId
      ? parseRoutineItemId(editFormItemId).routineId
      : editFormItemId

  if (!editFormOpen || !editFormItemType) return null

  // ------ Resolve the source item + initial form data ------
  let initialData: ItemEditFormInitialData | undefined
  let sourceEvent: CalendarEvent | undefined
  let sourceTask: Task | undefined

  if (!isEdit) {
    initialData = (editFormInitialData ?? undefined) as
      | ItemEditFormInitialData
      | undefined
  } else if (editFormItemType === 'event') {
    sourceEvent = events.find((e) => e.id === editFormItemId)
    if (!sourceEvent) return null
    initialData = eventInitialData(sourceEvent)
  } else if (editFormItemType === 'task') {
    sourceTask = taskDetail.data ?? tasks.find((t) => t.id === editFormItemId)
    // Wait for the detail fetch so subtasks/tags are populated.
    if (!sourceTask || (isTaskEdit && !taskDetail.data)) return null
    initialData = taskInitialData(sourceTask)
  } else {
    const routine = routines.find((r) => r.id === routineBaseId)
    if (!routine) return null
    initialData = routineInitialData(routine)
  }

  const attendeeCount = sourceEvent?.attendees?.length ?? 0
  const subtaskCount = sourceTask?.subtasks?.length ?? 0

  // ------ Save routing ------
  function createItem(type: ItemType, data: Record<string, unknown>) {
    if (!userId) return
    if (type === 'event') {
      const calendarId =
        (data.calendar_id as string | null) ?? calendars[0]?.id ?? null
      if (!calendarId) {
        window.alert('Connect a calendar before creating an event.')
        return
      }
      createEvent.mutate({
        user_id: userId,
        calendar_id: calendarId,
        google_event_id: null,
        title: (data.title as string) ?? 'Untitled',
        notes: (data.notes as string | null) ?? null,
        start_time: data.start_time as string,
        end_time: data.end_time as string,
        timezone: (data.timezone as string) ?? 'America/New_York',
        is_all_day: Boolean(data.is_all_day),
        location: (data.location as string | null) ?? null,
        color_override: null,
        visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
        privacy: (data.privacy as 'public' | 'private') ?? 'public',
        conferencing_url: (data.conferencing_url as string | null) ?? null,
        recurrence_rule: (data.recurrence_rule as string | null) ?? null,
        recurrence_id: null,
        attendees: (data.attendees as CalendarEvent['attendees']) ?? [],
        reminders: (data.reminders as CalendarEvent['reminders']) ?? [],
        status: 'confirmed',
        sync_status: 'pending_push',
        etag: null,
      })
    } else if (type === 'task') {
      createTask.mutate({
        user_id: userId,
        calendar_id: (data.calendar_id as string | null) ?? null,
        parent_id: null,
        title: (data.title as string) ?? 'Untitled',
        notes: (data.notes as string | null) ?? null,
        importance: (data.importance as Task['importance']) ?? 'normal',
        time_estimate_minutes: (data.time_estimate_minutes as number | null) ?? null,
        earliest_start: (data.earliest_start as string | null) ?? null,
        due_date: (data.due_date as string | null) ?? null,
        due_date_recurrence: null,
        scheduled_start: (data.scheduled_start as string | null) ?? null,
        scheduled_end: (data.scheduled_end as string | null) ?? null,
        location: (data.location as string | null) ?? null,
        visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
        privacy: (data.privacy as 'private' | 'public') ?? 'private',
        flexibility: (data.flexibility as Task['flexibility']) ?? 'flexible',
        status: 'backlog',
        board: 'current',
        is_split: false,
        completed_at: null,
        position: null,
        reminders: (data.reminders as Task['reminders']) ?? [],
        tag_ids: (data.tags as string[]) ?? [],
      })
    } else {
      // Routine — user_id is required by RLS but omitted from the hook's input
      // type, so pass it through explicitly.
      createRoutine.mutate({
        user_id: userId,
        calendar_id: (data.calendar_id as string | null) ?? null,
        title: (data.title as string) ?? 'Untitled',
        notes: (data.notes as string | null) ?? null,
        start_time: (data.start_time as string) ?? '09:00',
        end_time: (data.end_time as string) ?? '10:00',
        timezone: (data.timezone as string) ?? 'America/New_York',
        recurrence_rule: (data.recurrence_rule as string) ?? 'FREQ=DAILY',
        location: (data.location as string | null) ?? null,
        visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
        privacy: (data.privacy as 'private' | 'public') ?? 'private',
        reminders: (data.reminders as Routine['reminders']) ?? [],
      } as unknown as Parameters<typeof createRoutine.mutate>[0])
    }
  }

  function updateItem(type: ItemType, id: string, data: Record<string, unknown>) {
    if (type === 'event') {
      updateEvent.mutate({
        id,
        data: {
          title: data.title as string,
          notes: (data.notes as string | null) ?? null,
          location: (data.location as string | null) ?? null,
          calendar_id: (data.calendar_id as string) ?? undefined,
          start_time: data.start_time as string,
          end_time: data.end_time as string,
          is_all_day: Boolean(data.is_all_day),
          recurrence_rule: (data.recurrence_rule as string | null) ?? null,
          conferencing_url: (data.conferencing_url as string | null) ?? null,
          visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
          privacy: (data.privacy as 'public' | 'private') ?? 'public',
          attendees: (data.attendees as CalendarEvent['attendees']) ?? [],
          reminders: (data.reminders as CalendarEvent['reminders']) ?? [],
          sync_status: 'pending_push',
        },
      })
    } else if (type === 'task') {
      updateTask.mutate({
        id,
        data: {
          title: data.title as string,
          notes: (data.notes as string | null) ?? null,
          location: (data.location as string | null) ?? null,
          calendar_id: (data.calendar_id as string | null) ?? null,
          importance: (data.importance as Task['importance']) ?? 'normal',
          time_estimate_minutes: (data.time_estimate_minutes as number | null) ?? null,
          due_date: (data.due_date as string | null) ?? null,
          earliest_start: (data.earliest_start as string | null) ?? null,
          scheduled_start: (data.scheduled_start as string | null) ?? null,
          scheduled_end: (data.scheduled_end as string | null) ?? null,
          visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
          privacy: (data.privacy as 'private' | 'public') ?? 'private',
          reminders: (data.reminders as Task['reminders']) ?? [],
          tag_ids: (data.tags as string[]) ?? [],
        },
      })
    } else {
      updateRoutine.mutate({
        id,
        data: {
          title: data.title as string,
          notes: (data.notes as string | null) ?? null,
          location: (data.location as string | null) ?? null,
          start_time: (data.start_time as string) ?? '09:00',
          end_time: (data.end_time as string) ?? '10:00',
          recurrence_rule: (data.recurrence_rule as string) ?? 'FREQ=DAILY',
          visibility: (data.visibility as 'busy' | 'free') ?? 'busy',
          privacy: (data.privacy as 'private' | 'public') ?? 'private',
          reminders: (data.reminders as Routine['reminders']) ?? [],
        },
      })
    }
  }

  async function convertItem(
    sourceType: ItemType,
    sourceId: string,
    targetType: ItemType,
    data: Record<string, unknown>
  ) {
    const req = convertRequirements(sourceType, targetType, {
      attendeeCount,
      subtaskCount,
    })

    if (req.needsConfirm && req.message) {
      if (!window.confirm(req.message)) return false
    }

    const calendarId = req.needsCalendar ? (data.calendar_id as string) : undefined
    if (req.needsCalendar && !calendarId) {
      window.alert('Choose a calendar to convert this into an event.')
      return false
    }
    const repeatPattern = req.needsRepeatPattern
      ? ((data.recurrence_rule as string) || 'FREQ=DAILY')
      : undefined

    const body = buildConvertBody({
      sourceType,
      sourceId,
      targetType,
      calendarId,
      repeatPattern,
    })

    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    invalidateAll(queryClient)
    if (!res.ok) {
      window.alert('Conversion failed. Please try again.')
      return false
    }
    return true
  }

  async function handleSave(
    type: ItemType,
    data: Record<string, unknown>,
    _scope?: RecurrenceEditScope
  ) {
    if (!isEdit) {
      createItem(type, data)
      closeEditForm()
      return
    }

    if (type === editFormItemType) {
      const id =
        editFormItemType === 'routine' ? routineBaseId! : editFormItemId!
      updateItem(type, id, data)
      closeEditForm()
      return
    }

    // Type conversion (#13)
    const sourceId =
      editFormItemType === 'routine' ? routineBaseId! : editFormItemId!
    const ok = await convertItem(editFormItemType as ItemType, sourceId, type, data)
    if (ok) closeEditForm()
  }

  function handleDelete(_scope?: RecurrenceEditScope) {
    if (!isEdit) {
      closeEditForm()
      return
    }
    if (editFormItemType === 'event') deleteEvent.mutate(editFormItemId!)
    else if (editFormItemType === 'task') deleteTask.mutate(editFormItemId!)
    else if (editFormItemType === 'routine' && routineBaseId)
      deleteRoutine.mutate(routineBaseId)
    closeEditForm()
  }

  async function handleSplit() {
    if (!isEdit || editFormItemType !== 'task' || !editFormItemId) return
    const res = await fetch(`/api/tasks/${editFormItemId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    invalidateAll(queryClient)
    if (!res.ok) {
      window.alert('Could not split this task.')
      return
    }
    closeEditForm()
  }

  return (
    <ItemEditForm
      key={editFormItemId ?? 'new'}
      mode={isEdit ? 'edit' : 'create'}
      initialType={editFormTab}
      initialData={initialData}
      calendars={calendars}
      availableTags={tags}
      onSave={handleSave}
      onDelete={handleDelete}
      onSplit={handleSplit}
      onClose={closeEditForm}
    />
  )
}
