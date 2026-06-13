import { describe, it, expect } from 'vitest'
import { scoreTask, scoreTasks, DEFAULT_WEIGHTS } from '../scorer'
import type { Task } from '@poolendar/types'
import type { Tag } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-13T12:00:00Z')

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    user_id: 'user-1',
    calendar_id: null,
    parent_id: null,
    title: 'Test task',
    notes: null,
    importance: 'normal',
    time_estimate_minutes: 30,
    earliest_start: null,
    due_date: null,
    due_date_recurrence: null,
    scheduled_start: null,
    scheduled_end: null,
    location: null,
    visibility: 'busy',
    privacy: 'private',
    flexibility: 'flexible',
    frame_id: null,
    auto_scheduled: false,
    status: 'backlog',
    board: 'current',
    is_split: false,
    completed_at: null,
    position: null,
    reminders: [],
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  }
}

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    user_id: 'user-1',
    name: 'work',
    color: '#ff0000',
    prefix: null,
    priority_rank: 5,
    created_at: NOW.toISOString(),
    ...overrides,
  }
}

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

function daysFromNow(n: number): string {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoreTask', () => {
  it('produces a score in the 0-1 range with default weights', () => {
    const result = scoreTask(makeTask(), DEFAULT_WEIGHTS, NOW)

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it('scores highest importance higher than lowest importance', () => {
    const highest = scoreTask(
      makeTask({ importance: 'highest' }),
      DEFAULT_WEIGHTS,
      NOW,
    )
    const lowest = scoreTask(
      makeTask({ importance: 'lowest' }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(highest.score).toBeGreaterThan(lowest.score)
    expect(highest.components.urgency).toBe(1.0) // (5-1)/4
    expect(lowest.components.urgency).toBe(0.0) // (1-1)/4
  })

  it('scores higher deadline pressure for task due tomorrow vs in 2 weeks', () => {
    const dueTomorrow = scoreTask(
      makeTask({ due_date: daysFromNow(1) }),
      DEFAULT_WEIGHTS,
      NOW,
    )
    const due2Weeks = scoreTask(
      makeTask({ due_date: daysFromNow(14) }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(dueTomorrow.components.deadline).toBeGreaterThan(
      due2Weeks.components.deadline,
    )
    // 1 day out => 1 - 1/14 ~= 0.929
    expect(dueTomorrow.components.deadline).toBeCloseTo(1 - 1 / 14, 2)
    // 14 days out => 1 - 14/14 = 0
    expect(due2Weeks.components.deadline).toBeCloseTo(0, 2)
  })

  it('scores 0 deadline pressure for task due in 14+ days', () => {
    const due20Days = scoreTask(
      makeTask({ due_date: daysFromNow(20) }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    // 20 days out => max(0, 1 - 20/14) = max(0, -0.43) = 0
    expect(due20Days.components.deadline).toBe(0)
  })

  it('scores 0 deadline pressure for "Someday" task (no due_date)', () => {
    const someday = scoreTask(
      makeTask({ due_date: null }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(someday.components.deadline).toBe(0)
  })

  it('scores higher tag priority for rank 1 than default rank 5', () => {
    const rank1 = scoreTask(
      makeTask({ tags: [makeTag({ priority_rank: 1 })] }),
      DEFAULT_WEIGHTS,
      NOW,
    )
    const rank5 = scoreTask(
      makeTask({ tags: [makeTag({ priority_rank: 5 })] }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(rank1.components.tag_priority).toBeGreaterThan(
      rank5.components.tag_priority,
    )
  })

  it('uses default tag priority of 0.5 when task has no tags', () => {
    const noTags = scoreTask(makeTask({ tags: undefined }), DEFAULT_WEIGHTS, NOW)

    expect(noTags.components.tag_priority).toBe(0.5)

    // Verify the weighted contribution: 0.20 * 0.5 = 0.1
    // With urgency=0.5 (normal), deadline=0, staleness=0 (created today):
    // score = 0.35*0.5 + 0.30*0 + 0.20*0.5 + 0.15*0 = 0.175 + 0 + 0.1 + 0 = 0.275
    expect(noTags.score).toBeCloseTo(0.275, 4)
  })

  it('gives max staleness (1.0) for task created 30+ days ago', () => {
    const old = scoreTask(
      makeTask({ created_at: daysAgo(45) }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(old.components.staleness).toBe(1.0)
  })

  it('gives 0 staleness for task created today', () => {
    const fresh = scoreTask(
      makeTask({ created_at: NOW.toISOString() }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(fresh.components.staleness).toBe(0)
  })

  it('clamps staleness to 0 for task with future created_at', () => {
    const future = scoreTask(
      makeTask({ created_at: daysFromNow(5) }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    expect(future.components.staleness).toBe(0)
    expect(future.components.staleness).not.toBeLessThan(0)
  })

  it('changes score proportionally with custom weights', () => {
    const task = makeTask({ importance: 'highest', due_date: daysFromNow(1) })

    const urgencyHeavy = scoreTask(
      task,
      { urgency: 0.9, deadline: 0.05, tag_priority: 0.025, staleness: 0.025 },
      NOW,
    )
    const deadlineHeavy = scoreTask(
      task,
      { urgency: 0.05, deadline: 0.9, tag_priority: 0.025, staleness: 0.025 },
      NOW,
    )

    // urgency component = 1.0 (highest), deadline ~= 0.929
    // urgencyHeavy score dominated by urgency=1.0
    // deadlineHeavy score dominated by deadline~=0.929
    expect(urgencyHeavy.score).toBeGreaterThan(deadlineHeavy.score)
  })

  it('approaches 1.0 when all factors are at maximum', () => {
    const maxTask = makeTask({
      importance: 'highest',
      due_date: NOW.toISOString(), // due NOW => daysUntil=0 => deadline=1
      created_at: daysAgo(60),     // 60 days old => staleness=1
      tags: [makeTag({ priority_rank: 1 })], // rank 1 => tag_priority=1
    })

    const result = scoreTask(maxTask, DEFAULT_WEIGHTS, NOW)

    // urgency=1, deadline=1, tag_priority=1, staleness=1
    // score = 0.35 + 0.30 + 0.20 + 0.15 = 1.0
    expect(result.score).toBeCloseTo(1.0, 4)
    expect(result.components.urgency).toBe(1.0)
    expect(result.components.deadline).toBe(1.0)
    expect(result.components.tag_priority).toBe(1.0)
    expect(result.components.staleness).toBe(1.0)
  })

  it('approaches 0.0 when all factors are at minimum', () => {
    const minTask = makeTask({
      importance: 'lowest',
      due_date: null,              // no deadline => 0
      created_at: NOW.toISOString(), // created now => staleness 0
      tags: [makeTag({ priority_rank: 10 })], // rank 10 => tag_priority=0
    })

    const result = scoreTask(minTask, DEFAULT_WEIGHTS, NOW)

    // urgency=0, deadline=0, tag_priority=0, staleness=0
    // score = 0
    expect(result.score).toBeCloseTo(0.0, 4)
    expect(result.components.urgency).toBe(0.0)
    expect(result.components.deadline).toBe(0.0)
    expect(result.components.tag_priority).toBe(0.0)
    expect(result.components.staleness).toBe(0.0)
  })

  it('picks the BEST (lowest rank number) tag via Math.min', () => {
    const mixed = scoreTask(
      makeTask({
        tags: [
          makeTag({ priority_rank: 8 }),
          makeTag({ id: 'tag-2', priority_rank: 2 }),
          makeTag({ id: 'tag-3', priority_rank: 6 }),
        ],
      }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    // bestRank = min(8, 2, 6) = 2
    // tag_priority = (10 - 2) / 9 = 8/9 ~= 0.889
    expect(mixed.components.tag_priority).toBeCloseTo(8 / 9, 4)
  })

  it('inverts tag rank correctly: rank 1 -> ~1.0, rank 10 -> ~0.0', () => {
    const rank1 = scoreTask(
      makeTask({ tags: [makeTag({ priority_rank: 1 })] }),
      DEFAULT_WEIGHTS,
      NOW,
    )
    const rank10 = scoreTask(
      makeTask({ tags: [makeTag({ priority_rank: 10 })] }),
      DEFAULT_WEIGHTS,
      NOW,
    )

    // rank 1 => (10-1)/9 = 1.0
    expect(rank1.components.tag_priority).toBeCloseTo(1.0, 4)
    // rank 10 => (10-10)/9 = 0.0
    expect(rank10.components.tag_priority).toBeCloseTo(0.0, 4)
  })
})

describe('scoreTasks', () => {
  it('returns tasks sorted by score descending', () => {
    const tasks = [
      makeTask({ id: 'low', importance: 'lowest' }),
      makeTask({ id: 'high', importance: 'highest' }),
      makeTask({ id: 'mid', importance: 'normal' }),
    ]

    const scored = scoreTasks(tasks, DEFAULT_WEIGHTS, NOW)

    expect(scored[0]!.task.id).toBe('high')
    expect(scored[scored.length - 1]!.task.id).toBe('low')
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1]!.score).toBeGreaterThanOrEqual(scored[i]!.score)
    }
  })

  it('returns empty array for empty input', () => {
    expect(scoreTasks([], DEFAULT_WEIGHTS, NOW)).toEqual([])
  })
})
