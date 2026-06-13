'use client'

import * as React from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Active,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  getDay,
  parseISO,
  setHours,
  setMinutes,
} from 'date-fns'
import { cn } from '@/lib/utils'
import type {
  CalendarEvent,
  Task,
  Routine,
  Calendar,
} from '@poolendar/types'
import type { CalendarItemData, CalendarItemType } from './calendar-types'
import { TimeColumn } from './TimeColumn'
import { DayColumn } from './DayColumn'
import { CalendarDragOverlay } from './CalendarDragOverlay'
import { MonthGrid } from './MonthGrid'
import { NewItemPopover } from './NewItemPopover'

interface CalendarGridProps {
  view: 'day' | 'week' | 'month'
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  routines: Routine[]
  calendars: Calendar[]
  hourHeight?: number
  onItemClick?: (item: CalendarItemData) => void
  onItemDoubleClick?: (item: CalendarItemData) => void
  onTimeSlotClick?: (date: Date, time: Date) => void
  onItemReschedule?: (
    itemId: string,
    itemType: CalendarItemType,
    newStart: Date,
    newEnd: Date
  ) => void
  onItemResize?: (
    itemId: string,
    itemType: CalendarItemType,
    newEnd: Date
  ) => void
}

const DEFAULT_HOUR_HEIGHT = 60
const SCROLL_TO_HOUR = 8

function getCalendarColor(
  calendars: Calendar[],
  calendarId: string | null,
  colorOverride: string | null
): string {
  if (colorOverride) return colorOverride
  if (calendarId) {
    const cal = calendars.find((c) => c.id === calendarId)
    if (cal) return cal.color
  }
  return '#f9a825'
}

function eventsToItems(
  events: CalendarEvent[],
  calendars: Calendar[]
): CalendarItemData[] {
  return events
    .filter((e) => e.status !== 'cancelled')
    .map((event) => ({
      id: event.id,
      type: 'event' as const,
      title: event.title,
      startTime: parseISO(event.start_time),
      endTime: parseISO(event.end_time),
      color: getCalendarColor(calendars, event.calendar_id, event.color_override),
      isAllDay: event.is_all_day,
      location: event.location,
      event,
    }))
}

function tasksToItems(
  tasks: Task[],
  calendars: Calendar[]
): CalendarItemData[] {
  return tasks
    .filter((t) => t.scheduled_start && t.scheduled_end)
    .map((task) => {
      let subtaskProgress: { completed: number; total: number } | null = null
      if (task.subtasks && task.subtasks.length > 0) {
        subtaskProgress = {
          completed: task.subtasks.filter((s) => s.completed).length,
          total: task.subtasks.length,
        }
      }

      return {
        id: task.id,
        type: 'task' as const,
        title: task.title,
        startTime: parseISO(task.scheduled_start!),
        endTime: parseISO(task.scheduled_end!),
        color: getCalendarColor(calendars, task.calendar_id, null),
        location: task.location,
        task,
        subtaskProgress,
      }
    })
}

function routinesToItems(
  routines: Routine[],
  visibleDays: Date[],
  calendars: Calendar[]
): CalendarItemData[] {
  const items: CalendarItemData[] = []

  for (const routine of routines) {
    const routineStartParts = routine.start_time.split('T')
    const routineEndParts = routine.end_time.split('T')

    let startHour = 9
    let startMinute = 0
    let endHour = 10
    let endMinute = 0

    if (routineStartParts.length > 1) {
      const timeParts = routineStartParts[1].split(':')
      startHour = parseInt(timeParts[0], 10) || 0
      startMinute = parseInt(timeParts[1], 10) || 0
    }
    if (routineEndParts.length > 1) {
      const timeParts = routineEndParts[1].split(':')
      endHour = parseInt(timeParts[0], 10) || 0
      endMinute = parseInt(timeParts[1], 10) || 0
    }

    for (const day of visibleDays) {
      const startTime = setMinutes(setHours(new Date(day), startHour), startMinute)
      startTime.setSeconds(0, 0)
      const endTime = setMinutes(setHours(new Date(day), endHour), endMinute)
      endTime.setSeconds(0, 0)

      items.push({
        id: `${routine.id}-${format(day, 'yyyy-MM-dd')}`,
        type: 'routine',
        title: routine.title,
        startTime,
        endTime,
        color: getCalendarColor(calendars, routine.calendar_id, null),
        location: routine.location,
        routine,
      })
    }
  }

  return items
}

function getVisibleDays(
  currentDate: Date,
  view: 'day' | 'week' | 'month'
): Date[] {
  switch (view) {
    case 'day':
      return [currentDate]
    case 'week': {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
      return eachDayOfInterval({ start: weekStart, end: weekEnd })
    }
    case 'month': {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
      return eachDayOfInterval({ start: calStart, end: calEnd })
    }
  }
}

function getItemsForDay(
  items: CalendarItemData[],
  day: Date,
  allDay: boolean
): CalendarItemData[] {
  return items.filter((item) => {
    if (allDay) return item.isAllDay && isSameDay(item.startTime, day)
    return !item.isAllDay && isSameDay(item.startTime, day)
  })
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarGrid({
  view,
  currentDate,
  events,
  tasks,
  routines,
  calendars,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  onItemClick,
  onItemDoubleClick,
  onTimeSlotClick,
  onItemReschedule,
}: CalendarGridProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [activeItem, setActiveItem] = React.useState<Active | null>(null)
  const [popoverState, setPopoverState] = React.useState<{
    date: Date
    startTime: Date
    anchorRect: DOMRect
  } | null>(null)

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(mouseSensor, touchSensor)

  const visibleDays = getVisibleDays(currentDate, view)

  const allItems = React.useMemo(() => {
    const eventItems = eventsToItems(events, calendars)
    const taskItems = tasksToItems(tasks, calendars)
    const routineItems = routinesToItems(routines, visibleDays, calendars)
    return [...eventItems, ...taskItems, ...routineItems]
  }, [events, tasks, routines, calendars, visibleDays])

  React.useEffect(() => {
    if (view === 'month') return
    if (!scrollRef.current) return

    const scrollTarget = SCROLL_TO_HOUR * hourHeight
    scrollRef.current.scrollTop = scrollTarget
  }, [view, hourHeight, currentDate])

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(event.active)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)

    const { active, over } = event
    if (!over) return

    const draggedItem = active.data?.current?.item as CalendarItemData | undefined
    if (!draggedItem) return

    const dropData = over.data?.current as { type?: string; date?: Date } | undefined
    if (!dropData || dropData.type !== 'day-column' || !dropData.date) return

    const dropDate = dropData.date
    const durationMs = draggedItem.endTime.getTime() - draggedItem.startTime.getTime()
    const newStart = new Date(dropDate)
    newStart.setHours(
      draggedItem.startTime.getHours(),
      draggedItem.startTime.getMinutes(),
      0,
      0
    )
    const newEnd = new Date(newStart.getTime() + durationMs)

    onItemReschedule?.(draggedItem.id, draggedItem.type, newStart, newEnd)
  }

  function handleTimeSlotClick(date: Date, time: Date) {
    if (onTimeSlotClick) {
      onTimeSlotClick(date, time)
    }

    const el = scrollRef.current
    if (!el) return

    const top = (time.getHours() + time.getMinutes() / 60) * hourHeight
    const rect = el.getBoundingClientRect()
    const anchorRect = new DOMRect(
      rect.left + rect.width / 2,
      rect.top + top - el.scrollTop,
      1,
      hourHeight / 2
    )

    setPopoverState({ date, startTime: time, anchorRect })
  }

  function handlePopoverClose() {
    setPopoverState(null)
  }

  function handleQuickCreate(title: string, type: 'event' | 'task') {
    setPopoverState(null)
    // Parent handles actual creation via onTimeSlotClick or a dedicated callback
  }

  function handleOpenFullForm(title: string, type: 'event' | 'task') {
    setPopoverState(null)
  }

  if (view === 'month') {
    return (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <MonthGrid
          currentDate={currentDate}
          visibleDays={visibleDays}
          items={allItems}
          onItemClick={onItemClick}
          onItemDoubleClick={onItemDoubleClick}
        />
        <CalendarDragOverlay active={activeItem} />
      </DndContext>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {view === 'week' && (
          <WeekHeader days={visibleDays} />
        )}

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="flex min-h-0">
            <TimeColumn hourHeight={hourHeight} />

            {visibleDays.map((day) => {
              const dayItems = getItemsForDay(allItems, day, false)
              return (
                <DayColumn
                  key={day.toISOString()}
                  date={day}
                  items={dayItems}
                  hourHeight={hourHeight}
                  isToday={isToday(day)}
                  onTimeSlotClick={handleTimeSlotClick}
                  onItemClick={onItemClick}
                  onItemDoubleClick={onItemDoubleClick}
                />
              )
            })}
          </div>
        </div>
      </div>

      <CalendarDragOverlay active={activeItem} />

      {popoverState && (
        <NewItemPopover
          date={popoverState.date}
          startTime={popoverState.startTime}
          anchorRect={popoverState.anchorRect}
          onClose={handlePopoverClose}
          onQuickCreate={handleQuickCreate}
          onOpenFullForm={handleOpenFullForm}
        />
      )}
    </DndContext>
  )
}

// ---------------------------------------------------------------------------
// Week header sub-component
// ---------------------------------------------------------------------------

interface WeekHeaderProps {
  days: Date[]
}

function WeekHeader({ days }: WeekHeaderProps) {
  return (
    <div className="flex border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="shrink-0" style={{ width: 60 }} />

      {days.map((day) => {
        const today = isToday(day)
        const dayNum = format(day, 'd')
        const dayName = DAY_NAMES[getDay(day)]

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center py-2',
              'border-l border-[var(--border)]'
            )}
          >
            <span
              className={cn(
                'text-xs font-medium uppercase',
                today ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
              )}
            >
              {dayName}
            </span>

            <span
              className={cn(
                'flex items-center justify-center mt-0.5',
                'w-7 h-7 rounded-full text-sm font-semibold',
                today
                  ? 'bg-[var(--accent)] text-[var(--bg)]'
                  : 'text-[var(--fg)]'
              )}
            >
              {dayNum}
            </span>
          </div>
        )
      })}
    </div>
  )
}

