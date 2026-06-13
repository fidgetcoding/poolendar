import { describe, it, expect } from 'vitest'
import { generateFrameInstances, placeTasks } from '../placer'
import type { FreeSlot, FrameInstance } from '../placer'
import type { ScoredTask } from '../scorer'
import type { Frame, AutoSchedulePlacement } from '@poolendar/types'
import type { Task } from '@poolendar/types'
import type { Tag } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Friday 2026-06-12 is day 5, Saturday is 6, Sunday is 0, Monday is 1 */
const MONDAY = new Date('2026-06-15T00:00:00')
const TUESDAY = new Date('2026-06-16T00:00:00')
const WEDNESDAY = new Date('2026-06-17T00:00:00')
const FRIDAY = new Date('2026-06-19T00:00:00')

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'frame-1',
    user_id: 'user-1',
    name: 'Deep Work',
    description: null,
    color: '#3b82f6',
    time_blocks: [
      { day: 1, start: '09:00', end: '12:00' }, // Monday 9-12 (180 min)
    ],
    recurrence_rule: null,
    is_active: true,
    day_overrides: {},
    priority_rank: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

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
    created_at: '2026-06-13T00:00:00Z',
    updated_at: '2026-06-13T00:00:00Z',
    ...overrides,
  }
}

function makeScoredTask(
  taskOverrides: Partial<Task> = {},
  score = 0.5,
): ScoredTask {
  return {
    task: makeTask(taskOverrides),
    score,
    components: { urgency: 0.5, deadline: 0, tag_priority: 0.5, staleness: 0 },
  }
}

function dateAt(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base)
  d.setHours(hours, minutes, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// generateFrameInstances
// ---------------------------------------------------------------------------

describe('generateFrameInstances', () => {
  it('generates instances for each active frame on each matching day', () => {
    const frame = makeFrame({
      time_blocks: [
        { day: 1, start: '09:00', end: '12:00' }, // Monday
        { day: 3, start: '14:00', end: '16:00' }, // Wednesday
      ],
    })

    // Monday 2026-06-15 through Friday 2026-06-19
    const instances = generateFrameInstances(
      [frame],
      MONDAY,
      FRIDAY,
      [],
    )

    // Should get Monday (day 1) and Wednesday (day 3)
    expect(instances).toHaveLength(2)
    expect(instances[0]!.date).toBe('2026-06-15') // Monday
    expect(instances[1]!.date).toBe('2026-06-17') // Wednesday
  })

  it('skips inactive frames', () => {
    const inactive = makeFrame({ is_active: false })

    const instances = generateFrameInstances([inactive], MONDAY, FRIDAY, [])

    expect(instances).toHaveLength(0)
  })

  it('respects day overrides (skipped dates produce no instance)', () => {
    const frame = makeFrame({
      day_overrides: { '2026-06-15': false }, // Skip this Monday
    })

    const instances = generateFrameInstances([frame], MONDAY, TUESDAY, [])

    expect(instances).toHaveLength(0)
  })

  it('calculates available minutes correctly after subtracting existing events', () => {
    const frame = makeFrame() // Monday 09:00-12:00 = 180 min

    // Existing 30min event from 10:00-10:30
    const existing = [
      { start: dateAt(MONDAY, 10, 0), end: dateAt(MONDAY, 10, 30) },
    ]

    const instances = generateFrameInstances([frame], MONDAY, MONDAY, existing)

    expect(instances).toHaveLength(1)
    // 180 total - 30 event = 150 available
    expect(instances[0]!.availableMinutes).toBe(150)
  })

  it('produces 2 free slots when event is in middle of block', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    const existing = [
      { start: dateAt(MONDAY, 10, 0), end: dateAt(MONDAY, 10, 30) },
    ]

    const instances = generateFrameInstances([frame], MONDAY, MONDAY, existing)
    const slots = instances[0]!.freeSlots

    // Slot 1: 09:00-10:00 (60 min)
    // Slot 2: 10:30-12:00 (90 min)
    expect(slots).toHaveLength(2)
    expect(slots[0]!.minutes).toBe(60)
    expect(slots[1]!.minutes).toBe(90)
  })

  it('produces 1 free slot at end when event is at start of block', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    const existing = [
      { start: dateAt(MONDAY, 9, 0), end: dateAt(MONDAY, 10, 0) },
    ]

    const instances = generateFrameInstances([frame], MONDAY, MONDAY, existing)
    const slots = instances[0]!.freeSlots

    // Only free from 10:00-12:00 (120 min)
    expect(slots).toHaveLength(1)
    expect(slots[0]!.minutes).toBe(120)
  })

  it('merges overlapping existing events correctly', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    // Two overlapping events: 10:00-10:45 and 10:30-11:00
    // Merged: 10:00-11:00
    const existing = [
      { start: dateAt(MONDAY, 10, 0), end: dateAt(MONDAY, 10, 45) },
      { start: dateAt(MONDAY, 10, 30), end: dateAt(MONDAY, 11, 0) },
    ]

    const instances = generateFrameInstances([frame], MONDAY, MONDAY, existing)
    const slots = instances[0]!.freeSlots

    // Slot 1: 09:00-10:00 (60 min)
    // Slot 2: 11:00-12:00 (60 min)
    expect(slots).toHaveLength(2)
    expect(slots[0]!.minutes).toBe(60)
    expect(slots[1]!.minutes).toBe(60)
    expect(instances[0]!.availableMinutes).toBe(120)
  })

  it('excludes instance when available minutes are zero', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    // Event fills the entire block
    const existing = [
      { start: dateAt(MONDAY, 9, 0), end: dateAt(MONDAY, 12, 0) },
    ]

    const instances = generateFrameInstances([frame], MONDAY, MONDAY, existing)

    expect(instances).toHaveLength(0)
  })

  it('sorts instances by date then priority_rank', () => {
    const highPriority = makeFrame({
      id: 'frame-high',
      name: 'Priority A',
      priority_rank: 1,
      time_blocks: [{ day: 1, start: '09:00', end: '10:00' }],
    })
    const lowPriority = makeFrame({
      id: 'frame-low',
      name: 'Priority B',
      priority_rank: 5,
      time_blocks: [{ day: 1, start: '14:00', end: '15:00' }],
    })

    const instances = generateFrameInstances(
      [lowPriority, highPriority],
      MONDAY,
      MONDAY,
      [],
    )

    expect(instances).toHaveLength(2)
    // Same day: sorted by start time first (09:00 < 14:00), then priority_rank
    expect(instances[0]!.frame.id).toBe('frame-high')
    expect(instances[1]!.frame.id).toBe('frame-low')
  })
})

// ---------------------------------------------------------------------------
// placeTasks
// ---------------------------------------------------------------------------

describe('placeTasks', () => {
  /** Build FrameInstances and remaining slots for a simple Monday 09:00-12:00 block */
  function buildInstances(
    frames: Frame[] = [makeFrame()],
    existingBlocks: { start: Date; end: Date }[] = [],
  ): FrameInstance[] {
    return generateFrameInstances(frames, MONDAY, FRIDAY, existingBlocks)
  }

  it('places highest-scored task first', () => {
    const tasks: ScoredTask[] = [
      makeScoredTask({ id: 'high', title: 'High' }, 0.9),
      makeScoredTask({ id: 'low', title: 'Low' }, 0.2),
    ]
    // scoredTasks are expected pre-sorted by caller
    const instances = buildInstances()
    const classifications = new Map<string, string>()

    const placements = placeTasks(tasks, instances, classifications)

    expect(placements).toHaveLength(2)
    expect(placements[0]!.task_id).toBe('high')
    expect(placements[0]!.score).toBe(0.9)
  })

  it('places task in classified frame when available', () => {
    const deepWork = makeFrame({
      id: 'deep',
      name: 'Deep Work',
      priority_rank: 2,
      time_blocks: [{ day: 1, start: '09:00', end: '12:00' }],
    })
    const admin = makeFrame({
      id: 'admin',
      name: 'Admin',
      priority_rank: 1,
      time_blocks: [{ day: 1, start: '13:00', end: '15:00' }],
    })

    const tasks: ScoredTask[] = [
      makeScoredTask({ id: 'task-code', title: 'Write code' }, 0.8),
    ]
    const instances = buildInstances([deepWork, admin])
    const classifications = new Map([['task-code', 'deep']])

    const placements = placeTasks(tasks, instances, classifications)

    expect(placements).toHaveLength(1)
    expect(placements[0]!.frame_id).toBe('deep')
    expect(placements[0]!.frame_name).toBe('Deep Work')
  })

  it('falls back to any frame when classified frame is full', () => {
    const deepWork = makeFrame({
      id: 'deep',
      name: 'Deep Work',
      priority_rank: 1,
      time_blocks: [{ day: 1, start: '09:00', end: '09:15' }], // Only 15 min
    })
    const admin = makeFrame({
      id: 'admin',
      name: 'Admin',
      priority_rank: 2,
      time_blocks: [{ day: 1, start: '13:00', end: '15:00' }],
    })

    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'task-code', title: 'Write code', time_estimate_minutes: 60 },
        0.8,
      ),
    ]
    const instances = buildInstances([deepWork, admin])
    const classifications = new Map([['task-code', 'deep']])

    const placements = placeTasks(tasks, instances, classifications)

    expect(placements).toHaveLength(1)
    // Classified deep only has 15 min; task needs 60 min => falls back to admin
    expect(placements[0]!.frame_id).toBe('admin')
  })

  it('does not place a 2h task in a 30min slot', () => {
    const frame = makeFrame({
      time_blocks: [{ day: 1, start: '09:00', end: '09:30' }], // 30 min
    })

    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'big', title: 'Big task', time_estimate_minutes: 120 },
        0.9,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(0)
  })

  it('respects earliest_start (skips frame instances before that date)', () => {
    // Frame available Monday and Wednesday
    const frame = makeFrame({
      time_blocks: [
        { day: 1, start: '09:00', end: '12:00' }, // Monday
        { day: 3, start: '09:00', end: '12:00' }, // Wednesday
      ],
    })

    const tasks: ScoredTask[] = [
      makeScoredTask(
        {
          id: 'delayed',
          title: 'Delayed task',
          earliest_start: '2026-06-17T00:00:00', // Wednesday
        },
        0.8,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(1)
    // Should skip Monday (ends before earliest_start), land on Wednesday
    expect(placements[0]!.scheduled_start).toContain('2026-06-17')
  })

  it('respects due_date (skips frame instances after due date)', () => {
    const frame = makeFrame({
      time_blocks: [
        { day: 1, start: '09:00', end: '12:00' }, // Monday 6/15
        { day: 3, start: '09:00', end: '12:00' }, // Wednesday 6/17
      ],
    })

    const tasks: ScoredTask[] = [
      makeScoredTask(
        {
          id: 'urgent',
          title: 'Urgent task',
          due_date: '2026-06-15T23:59:59', // Due end of Monday
          time_estimate_minutes: 30,
        },
        0.9,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(1)
    // Must be placed on Monday, not Wednesday (after due date)
    expect(placements[0]!.scheduled_start).toContain('2026-06-15')
  })

  it('clamps zero time_estimate to minimum 1 minute', () => {
    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'zero', title: 'Zero est', time_estimate_minutes: 0 },
        0.5,
      ),
    ]
    const instances = buildInstances()

    const placements = placeTasks(tasks, instances, new Map())

    // Should still place (1 min duration)
    expect(placements).toHaveLength(1)
    const start = new Date(placements[0]!.scheduled_start)
    const end = new Date(placements[0]!.scheduled_end)
    const durationMin = (end.getTime() - start.getTime()) / 60000
    expect(durationMin).toBe(1)
  })

  it('clamps negative time_estimate to minimum 1 minute', () => {
    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'neg', title: 'Negative est', time_estimate_minutes: -10 },
        0.5,
      ),
    ]
    const instances = buildInstances()

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(1)
    const start = new Date(placements[0]!.scheduled_start)
    const end = new Date(placements[0]!.scheduled_end)
    const durationMin = (end.getTime() - start.getTime()) / 60000
    expect(durationMin).toBe(1)
  })

  it('reduces the free slot after placing a task (slot consumption)', () => {
    const frame = makeFrame() // Monday 09:00-12:00 (180 min)

    // Place a 60-min task, then a 90-min task. Both should fit.
    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'first', title: 'First', time_estimate_minutes: 60 },
        0.9,
      ),
      makeScoredTask(
        { id: 'second', title: 'Second', time_estimate_minutes: 90 },
        0.8,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(2)
    // First task starts at 09:00 local
    const firstStart = new Date(placements[0]!.scheduled_start)
    expect(firstStart.getHours()).toBe(9)
    expect(firstStart.getMinutes()).toBe(0)
    // Second task starts right after (10:00 local), runs 90 min
    const secondStart = new Date(placements[1]!.scheduled_start)
    const secondEnd = new Date(placements[1]!.scheduled_end)
    expect(secondStart.getHours()).toBe(10)
    expect((secondEnd.getTime() - secondStart.getTime()) / 60000).toBe(90)
  })

  it('splits slot into before/after gaps when task is placed mid-slot', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    // Task with earliest_start at 10:00 placed in the 09:00-12:00 slot
    // Should leave gap 09:00-10:00 before it
    const tasks: ScoredTask[] = [
      makeScoredTask(
        {
          id: 'mid',
          title: 'Mid slot',
          time_estimate_minutes: 60,
          earliest_start: dateAt(MONDAY, 10, 0).toISOString(),
        },
        0.9,
      ),
      makeScoredTask(
        {
          id: 'fill-before',
          title: 'Fill gap before',
          time_estimate_minutes: 30,
        },
        0.5,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(2)
    // First task: 10:00-11:00 (constrained by earliest_start)
    expect(new Date(placements[0]!.scheduled_start).getHours()).toBe(10)
    // Second task should fill the gap BEFORE (09:00-10:00) or AFTER (11:00-12:00)
    // The split produces [09:00-10:00] and [11:00-12:00]
    // The second task (no earliest_start constraint) lands in the first available slot
    const secondStart = new Date(placements[1]!.scheduled_start)
    expect(
      secondStart.getHours() === 9 || secondStart.getHours() === 11,
    ).toBe(true)
  })

  it('fills a single frame instance with multiple tasks sequentially', () => {
    const frame = makeFrame() // Monday 09:00-12:00 (180 min)

    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 't1', title: 'Task 1', time_estimate_minutes: 60 },
        0.9,
      ),
      makeScoredTask(
        { id: 't2', title: 'Task 2', time_estimate_minutes: 60 },
        0.8,
      ),
      makeScoredTask(
        { id: 't3', title: 'Task 3', time_estimate_minutes: 60 },
        0.7,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(3)

    // Verify they fill 09:00-10:00, 10:00-11:00, 11:00-12:00
    for (let i = 0; i < placements.length; i++) {
      const start = new Date(placements[i]!.scheduled_start)
      expect(start.getHours()).toBe(9 + i)
    }
  })

  it('returns no placement (not an error) when task cannot fit anywhere', () => {
    const frame = makeFrame({
      time_blocks: [{ day: 1, start: '09:00', end: '09:15' }], // 15 min only
    })

    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'huge', title: 'Huge task', time_estimate_minutes: 480 },
        0.95,
      ),
    ]
    const instances = buildInstances([frame])

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(0)
  })

  it('does not overlap tasks with existing events (FreeSlot prevents double-booking)', () => {
    const frame = makeFrame() // Monday 09:00-12:00

    // Existing event 10:00-11:00
    const existing = [
      { start: dateAt(MONDAY, 10, 0), end: dateAt(MONDAY, 11, 0) },
    ]

    // Try to place 3 x 60-min tasks. Only 2 slots available: 09-10 and 11-12
    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 't1', title: 'Task 1', time_estimate_minutes: 60 },
        0.9,
      ),
      makeScoredTask(
        { id: 't2', title: 'Task 2', time_estimate_minutes: 60 },
        0.8,
      ),
      makeScoredTask(
        { id: 't3', title: 'Task 3', time_estimate_minutes: 60 },
        0.7,
      ),
    ]
    const instances = buildInstances([frame], existing)

    const placements = placeTasks(tasks, instances, new Map())

    // Only 2 of 3 tasks fit (120 min free, each needs 60)
    expect(placements).toHaveLength(2)

    // Verify no placement overlaps the 10:00-11:00 existing event
    for (const p of placements) {
      const pStart = new Date(p.scheduled_start)
      const pEnd = new Date(p.scheduled_end)
      const eventStart = dateAt(MONDAY, 10, 0)
      const eventEnd = dateAt(MONDAY, 11, 0)

      // No overlap: placement ends before event starts OR placement starts after event ends
      const noOverlap = pEnd <= eventStart || pStart >= eventEnd
      expect(noOverlap).toBe(true)
    }

    // Verify the two placed tasks are consecutive in the free slots
    const starts = placements.map(
      (p) => new Date(p.scheduled_start).getHours(),
    )
    expect(starts).toContain(9)  // 09:00-10:00 slot
    expect(starts).toContain(11) // 11:00-12:00 slot
  })

  it('uses null time_estimate default of 30 min', () => {
    const tasks: ScoredTask[] = [
      makeScoredTask(
        { id: 'default', title: 'Default est', time_estimate_minutes: null },
        0.5,
      ),
    ]
    const instances = buildInstances()

    const placements = placeTasks(tasks, instances, new Map())

    expect(placements).toHaveLength(1)
    const start = new Date(placements[0]!.scheduled_start)
    const end = new Date(placements[0]!.scheduled_end)
    const durationMin = (end.getTime() - start.getTime()) / 60000
    expect(durationMin).toBe(30)
  })
})
