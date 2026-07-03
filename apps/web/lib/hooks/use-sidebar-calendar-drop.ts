'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { Task, Routine } from '@poolendar/types'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUpdateTask } from '@/lib/hooks/use-tasks'
import { useUpdateRoutine } from '@/lib/hooks/use-routines'

/**
 * Drop-onto-calendar logic for sidebar tasks/routines (#33). Extracted from the
 * app layout. The calendar has its own inner DndContext, so the drop target is
 * resolved from pointer coordinates against DayColumn `data-day-column` nodes.
 */
export function useSidebarCalendarDrop() {
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const updateTask = useUpdateTask()
  const updateRoutine = useUpdateRoutine()

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleSidebarDrop(
    dragData: { type: string; task?: Task; routine?: Routine },
    dayColumnEl: HTMLElement,
    clientY: number
  ) {
    const rect = dayColumnEl.getBoundingClientRect()
    const hourHeight = useCalendarStore.getState().hourHeight || 60
    const resolution = useCalendarStore.getState().timeDraggingResolution || 15
    const yOffset = clientY - rect.top
    const rawMinutes = (yOffset / hourHeight) * 60
    const snappedMinutes = Math.round(rawMinutes / resolution) * resolution
    const clampedMinutes = Math.max(0, Math.min(24 * 60 - resolution, snappedMinutes))
    const startHour = Math.floor(clampedMinutes / 60)
    const startMinute = clampedMinutes % 60

    const dateAttr = dayColumnEl.dataset.dayColumn
    const dateStr = dateAttr || format(new Date(), 'yyyy-MM-dd')

    if (dragData.type === 'sidebar-task' && dragData.task) {
      const task = dragData.task
      const duration = task.time_estimate_minutes || 30
      const endMinutes = clampedMinutes + duration
      const endHour = Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60

      const scheduledStart = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
      const scheduledEnd = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`

      updateTask.mutate({
        id: task.id,
        data: { scheduled_start: scheduledStart, scheduled_end: scheduledEnd },
      })
    }

    if (dragData.type === 'sidebar-routine' && dragData.routine) {
      const routine = dragData.routine
      const startParts = routine.start_time.split('T')
      const endParts = routine.end_time.split('T')
      let durationMinutes = 60

      if (startParts.length > 1 && endParts.length > 1) {
        const sParts = (startParts[1] ?? '09:00').split(':').map(Number)
        const eParts = (endParts[1] ?? '10:00').split(':').map(Number)
        const sh = sParts[0] ?? 9
        const sm = sParts[1] ?? 0
        const eh = eParts[0] ?? 10
        const em = eParts[1] ?? 0
        durationMinutes = eh * 60 + em - (sh * 60 + sm)
        if (durationMinutes <= 0) durationMinutes = 60
      }

      const endMinutes = clampedMinutes + durationMinutes
      const endHour = Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60

      const newStartTime = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
      const newEndTime = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`

      updateRoutine.mutate({
        id: routine.id,
        data: { start_time: newStartTime, end_time: newEndTime },
      })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)

    const { active, over } = event
    const dragData = active.data?.current as
      | { type: string; task?: Task; routine?: Routine }
      | undefined

    if (!dragData) return

    if (dragData.type === 'sidebar-task' || dragData.type === 'sidebar-routine') {
      const activatorEvent = event.activatorEvent as MouseEvent | TouchEvent
      let clientX: number
      let clientY: number

      const deltaX = event.delta?.x ?? 0
      const deltaY = event.delta?.y ?? 0

      if ('touches' in activatorEvent && activatorEvent.touches.length > 0) {
        clientX = activatorEvent.touches[0]!.clientX + deltaX
        clientY = activatorEvent.touches[0]!.clientY + deltaY
      } else if ('clientX' in activatorEvent) {
        clientX = (activatorEvent as MouseEvent).clientX + deltaX
        clientY = (activatorEvent as MouseEvent).clientY + deltaY
      } else {
        return
      }

      const elements = document.elementsFromPoint(clientX, clientY)
      const dayColumnEl = elements.find(
        (el) => el instanceof HTMLElement && el.dataset?.dayColumn !== undefined
      ) as HTMLElement | undefined

      if (!dayColumnEl) {
        const calArea = elements.find(
          (el) => el instanceof HTMLElement && el.closest('[data-day-column]') !== null
        )
        if (calArea) {
          const col = (calArea as HTMLElement).closest('[data-day-column]') as HTMLElement | null
          if (col) {
            handleSidebarDrop(dragData, col, clientY)
            return
          }
        }
        return
      }

      handleSidebarDrop(dragData, dayColumnEl, clientY)
      return
    }

    if (!over || active.id === over.id) return
  }

  return { activeDragId, handleDragStart, handleDragEnd }
}
