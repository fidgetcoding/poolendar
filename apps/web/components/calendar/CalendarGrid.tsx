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
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isToday,
  getDay,
  getISOWeek,
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
import { useUIStore } from '@/lib/stores/ui-store'

interface CalendarGridProps {
  view: 'day' | 'week' | 'month'
  currentDate: Date
  events: CalendarEvent[]
  tasks: Task[]
  routines: Routine[]
  calendars: Calendar[]
  hourHeight?: number
  showWeekNumbers?: boolean
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
  onQuickCreate?: (title: string, type: CalendarItemType, startTime: Date) => void
  onRoutineCheckboxClick?: (item: CalendarItemData) => void
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
  const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }

  for (const routine of routines) {
    const routineStartParts = routine.start_time.split('T')
    const routineEndParts = routine.end_time.split('T')

    let startHour = 9
    let startMinute = 0
    let endHour = 10
    let endMinute = 0

    if (routineStartParts.length > 1) {
      const timeParts = routineStartParts[1]!.split(':')
      startHour = parseInt(timeParts[0] ?? '0', 10) || 0
      startMinute = parseInt(timeParts[1] ?? '0', 10) || 0
    }
    if (routineEndParts.length > 1) {
      const timeParts = routineEndParts[1]!.split(':')
      endHour = parseInt(timeParts[0] ?? '0', 10) || 0
      endMinute = parseInt(timeParts[1] ?? '0', 10) || 0
    }

    // Parse BYDAY from recurrence rule if present
    let allowedDays: number[] | null = null
    if (routine.recurrence_rule) {
      const byDayMatch = routine.recurrence_rule.match(/BYDAY=([A-Z,]+)/)
      if (byDayMatch) {
        allowedDays = byDayMatch[1]!.split(',').map(d => dayMap[d]).filter((d): d is number => d !== undefined)
      }
      // FREQ=DAILY means all days
      if (routine.recurrence_rule.includes('FREQ=DAILY')) {
        allowedDays = null
      }
    }

    for (const day of visibleDays) {
      // Skip days not in BYDAY
      if (allowedDays && !allowedDays.includes(day.getDay())) continue

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
  allDay = false
): CalendarItemData[] {
  return items.filter((item) => {
    if (allDay !== !!item.isAllDay) return false
    const dayStart = startOfDay(day)
    const dayEnd = endOfDay(day)
    return item.startTime < dayEnd && item.endTime > dayStart
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
  showWeekNumbers = false,
  onItemClick,
  onItemDoubleClick,
  onTimeSlotClick,
  onItemReschedule,
  onItemResize,
  onQuickCreate,
  onRoutineCheckboxClick,
}: CalendarGridProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [activeItem, setActiveItem] = React.useState<Active | null>(null)
  const [popoverState, setPopoverState] = React.useState<{
    date: Date
    startTime: Date
    endTime?: Date
    anchorRect: DOMRect
  } | null>(null)
  const uiStore = useUIStore()

  // Context menu handler for the calendar grid background
  function handleGridContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    // Check if the right-click was on a calendar item
    const itemEl = (e.target as HTMLElement).closest('[data-calendar-item]')
    if (itemEl) {
      const itemId = itemEl.getAttribute('data-item-id') ?? undefined
      const itemType = itemEl.getAttribute('data-item-type') as 'event' | 'task' | 'routine' | null
      if (itemId && itemType) {
        uiStore.openContextMenu(itemId, itemType, { x: e.clientX, y: e.clientY })
        return
      }
    }
    // Empty slot: open context menu with no item (for creating new items)
    uiStore.openContextMenu(null, null, { x: e.clientX, y: e.clientY })
  }

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 300, tolerance: 5 },
  })
  const sensors = useSensors(mouseSensor, touchSensor)

  const visibleDays = React.useMemo(
    () => getVisibleDays(currentDate, view),
    [currentDate, view]
  )

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

    let newHours = draggedItem.startTime.getHours()
    let newMinutes = draggedItem.startTime.getMinutes()

    // Use the drag delta Y to calculate time offset
    if (event.delta) {
      const deltaMinutes = Math.round((event.delta.y / hourHeight) * 60 / 15) * 15
      const totalMinutes = draggedItem.startTime.getHours() * 60 + draggedItem.startTime.getMinutes() + deltaMinutes
      newHours = Math.max(0, Math.min(23, Math.floor(totalMinutes / 60)))
      newMinutes = Math.max(0, totalMinutes % 60)
    }

    const newStart = new Date(dropDate)
    newStart.setHours(newHours, newMinutes, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)

    onItemReschedule?.(draggedItem.id, draggedItem.type, newStart, newEnd)
  }

  function handleTimeSlotClick(date: Date, time: Date, endTime?: Date) {
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

    setPopoverState({ date, startTime: time, endTime, anchorRect })
  }

  function handlePopoverClose() {
    setPopoverState(null)
  }

  function handleQuickCreate(title: string, type: 'event' | 'task') {
    if (title.trim() && popoverState) {
      onQuickCreate?.(title.trim(), type, popoverState.startTime)
    }
    setPopoverState(null)
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
      <div className="flex flex-col flex-1 overflow-hidden" onContextMenu={handleGridContextMenu}>
        {view === 'week' && (
          <WeekHeader days={visibleDays} showWeekNumbers={showWeekNumbers} />
        )}

        {/* All-day events row */}
        <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="shrink-0 w-10 md:w-[60px] px-1 md:px-2 py-1 text-[10px] md:text-[11px] text-[var(--muted)]">
            all-day
          </div>
          <div className="flex flex-1">
            {visibleDays.map((day) => {
              const allDayItems = getItemsForDay(allItems, day, true)
              return (
                <div key={day.toISOString()} className="flex-1 min-h-[28px] p-1 border-l" style={{ borderColor: 'var(--border)' }}>
                  {allDayItems.map((item) => (
                    <div
                      key={item.id}
                      className="text-xs px-2 py-0.5 rounded mb-0.5 cursor-pointer truncate"
                      style={{ backgroundColor: item.color || 'var(--accent)', color: '#fff' }}
                      onClick={() => onItemClick?.(item)}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

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
                  onRoutineCheckboxClick={onRoutineCheckboxClick}
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
          endTime={popoverState.endTime}
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
  showWeekNumbers?: boolean
}

function WeekHeader({ days, showWeekNumbers = false }: WeekHeaderProps) {
  // Compute ISO week number from the first day of the visible week
  const weekNumber = days.length > 0 ? getISOWeek(days[0]!) : null

  return (
    <div className="flex border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="shrink-0 flex items-center justify-center w-10 md:w-[60px]">
        {showWeekNumbers && weekNumber !== null && (
          <span
            className="text-[10px] font-medium text-[var(--muted)]"
            title={`Week ${weekNumber}`}
          >
            W{weekNumber}
          </span>
        )}
      </div>

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

