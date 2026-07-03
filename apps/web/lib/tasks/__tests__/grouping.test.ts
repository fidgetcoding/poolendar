import { describe, it, expect } from 'vitest'
import { groupTasks, filterTasks, countGrouped, EMPTY_VIEW_FILTER } from '../grouping'
import type { Task } from '@poolendar/types'

const REF = new Date('2026-06-15T12:00:00') // Monday, local noon

function task(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u1',
    calendar_id: null,
    parent_id: null,
    title: 'Task',
    notes: null,
    importance: 'normal',
    time_estimate_minutes: null,
    earliest_start: null,
    due_date: null,
    due_date_recurrence: null,
    scheduled_start: null,
    scheduled_end: null,
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
    created_at: '',
    updated_at: '',
    subtasks: [],
    tags: [],
    children: [],
    ...overrides,
  }
}

describe('groupTasks — edge dates (#30)', () => {
  it('buckets by due date relative to the reference day', () => {
    const tasks = [
      task({ id: 'overdue', due_date: '2026-06-14' }),
      task({ id: 'today', due_date: '2026-06-15' }),
      task({ id: 'tomorrow', due_date: '2026-06-16' }),
      task({ id: 'soon-mid', due_date: '2026-06-18' }),
      task({ id: 'soon-edge', due_date: '2026-06-23' }), // tomorrow + 7 → inclusive
      task({ id: 'beyond', due_date: '2026-07-10' }), // past the window → inbox
      task({ id: 'no-due', due_date: null }),
    ]
    const g = groupTasks(tasks, REF)

    expect(g.overdue.map((t) => t.id)).toEqual(['overdue'])
    expect(g.dueToday.map((t) => t.id)).toEqual(['today'])
    expect(g.dueTomorrow.map((t) => t.id)).toEqual(['tomorrow'])
    expect(g.dueSoon.map((t) => t.id).sort()).toEqual(['soon-edge', 'soon-mid'])
    expect(g.inbox.map((t) => t.id).sort()).toEqual(['beyond', 'no-due'])
  })

  it('keeps unscheduled non-backlog tasks in inbox (the amputated bug)', () => {
    const tasks = [
      task({ id: 'in-progress', status: 'in_progress', due_date: null }),
      task({ id: 'check', status: 'check', due_date: null }),
    ]
    const g = groupTasks(tasks, REF)
    expect(g.inbox.map((t) => t.id).sort()).toEqual(['check', 'in-progress'])
  })

  it('excludes done tasks from every bucket', () => {
    const g = groupTasks([task({ status: 'done', due_date: '2026-06-15' })], REF)
    expect(countGrouped(g)).toBe(0)
  })

  it('a task due beyond the window with a far-future date still lands in inbox, not lost', () => {
    const g = groupTasks([task({ id: 'far', due_date: '2027-01-01' })], REF)
    expect(g.inbox.map((t) => t.id)).toEqual(['far'])
  })
})

describe('filterTasks — View filter (#36)', () => {
  const tagged = task({
    id: 'a',
    importance: 'high',
    tags: [{ id: 'tag-1', user_id: 'u1', name: 'Work', color: '#fff', prefix: null, created_at: '' }],
  })
  const plain = task({ id: 'b', importance: 'low', tags: [] })

  it('returns all tasks when the filter is empty', () => {
    expect(filterTasks([tagged, plain], EMPTY_VIEW_FILTER)).toHaveLength(2)
  })

  it('filters by tag id', () => {
    const out = filterTasks([tagged, plain], { tagIds: ['tag-1'], importance: [] })
    expect(out.map((t) => t.id)).toEqual(['a'])
  })

  it('filters by importance', () => {
    const out = filterTasks([tagged, plain], { tagIds: [], importance: ['low'] })
    expect(out.map((t) => t.id)).toEqual(['b'])
  })

  it('combines tag AND importance', () => {
    expect(filterTasks([tagged, plain], { tagIds: ['tag-1'], importance: ['low'] })).toHaveLength(0)
    expect(filterTasks([tagged, plain], { tagIds: ['tag-1'], importance: ['high'] })).toHaveLength(1)
  })
})
