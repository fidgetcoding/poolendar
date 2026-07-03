import { startOfDay, isSameDay, addDays, isBefore, isAfter } from 'date-fns'
import type { Task, TaskImportance } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Task sidebar grouping (#30) — pure, so it can be unit-tested on edge dates.
//
// Groups (any non-done status):
//   - overdue     : has a due date before today
//   - dueToday    : due today
//   - dueTomorrow : due tomorrow
//   - dueSoon     : due within the 7 days after tomorrow
//   - inbox       : NO due date, OR due beyond the "due soon" window
//
// The previous implementation defined inbox as `!due_date && status==='backlog'`,
// which dropped unscheduled in_progress/check tasks and any task due more than a
// week out. This groups by due-date buckets and keeps every non-done task.
// ---------------------------------------------------------------------------

export interface GroupedTasks {
  overdue: Task[]
  dueToday: Task[]
  dueTomorrow: Task[]
  dueSoon: Task[]
  inbox: Task[]
}

/**
 * Parse a task `due_date` into that calendar day's start.
 * Date-only strings ("YYYY-MM-DD") are read as local midnight so a negative UTC
 * offset can't shift them to the previous day; full timestamps use their instant.
 */
export function toDueDay(due: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(due)
  const d = dateOnly ? new Date(`${due}T00:00:00`) : new Date(due)
  return startOfDay(d)
}

export function groupTasks(tasks: Task[], reference: Date = new Date()): GroupedTasks {
  const today = startOfDay(reference)
  const tomorrow = addDays(today, 1)
  // Inclusive upper edge of "due soon": the 7 days that follow tomorrow.
  const soonEnd = addDays(tomorrow, 7)

  const groups: GroupedTasks = {
    overdue: [],
    dueToday: [],
    dueTomorrow: [],
    dueSoon: [],
    inbox: [],
  }

  for (const task of tasks) {
    if (task.status === 'done') continue

    if (!task.due_date) {
      groups.inbox.push(task)
      continue
    }

    const day = toDueDay(task.due_date)

    if (isBefore(day, today)) {
      groups.overdue.push(task)
    } else if (isSameDay(day, today)) {
      groups.dueToday.push(task)
    } else if (isSameDay(day, tomorrow)) {
      groups.dueTomorrow.push(task)
    } else if (!isAfter(day, soonEnd)) {
      // tomorrow < day <= tomorrow + 7 days
      groups.dueSoon.push(task)
    } else {
      // Due beyond the window → inbox (per #30).
      groups.inbox.push(task)
    }
  }

  return groups
}

export function countGrouped(groups: GroupedTasks): number {
  return (
    groups.overdue.length +
    groups.dueToday.length +
    groups.dueTomorrow.length +
    groups.dueSoon.length +
    groups.inbox.length
  )
}

// ---------------------------------------------------------------------------
// View filter (#36) — filter by tag/project (tags double as projects, #61) and
// importance. Empty arrays mean "no constraint".
// ---------------------------------------------------------------------------

export interface TaskViewFilter {
  tagIds: string[]
  importance: TaskImportance[]
}

export const EMPTY_VIEW_FILTER: TaskViewFilter = {
  tagIds: [],
  importance: [],
}

export function isViewFilterActive(filter: TaskViewFilter): boolean {
  return filter.tagIds.length > 0 || filter.importance.length > 0
}

export function filterTasks(tasks: Task[], filter: TaskViewFilter): Task[] {
  if (!isViewFilterActive(filter)) return tasks
  return tasks.filter((task) => {
    if (filter.importance.length > 0 && !filter.importance.includes(task.importance)) {
      return false
    }
    if (filter.tagIds.length > 0) {
      const taskTagIds = (task.tags ?? []).map((t) => t.id)
      if (!filter.tagIds.some((id) => taskTagIds.includes(id))) return false
    }
    return true
  })
}
