import { addDays, startOfDay, format, differenceInMinutes } from 'date-fns'
import type { Frame, AutoSchedulePlacement } from '@poolendar/types'
import type { ScoredTask } from './scorer'

export interface FreeSlot {
  start: Date
  end: Date
  minutes: number
}

export interface FrameInstance {
  frame: Frame
  date: string
  start: Date
  end: Date
  availableMinutes: number
  freeSlots: FreeSlot[]
}

function parseTimeToDate(date: Date, time: string): Date {
  const parts = time.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function overlapMinutes(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  return Math.max(0, differenceInMinutes(end, start))
}

/**
 * Compute contiguous free slots within a frame block after subtracting existing events.
 * Returns slots sorted by start time.
 */
function computeFreeSlots(
  blockStart: Date,
  blockEnd: Date,
  existingBlocks: { start: Date; end: Date }[],
): FreeSlot[] {
  // Collect overlapping existing blocks clipped to the frame window
  const clipped: { start: Date; end: Date }[] = []
  for (const existing of existingBlocks) {
    const s = existing.start > blockStart ? existing.start : blockStart
    const e = existing.end < blockEnd ? existing.end : blockEnd
    if (s < e) clipped.push({ start: s, end: e })
  }

  // Sort by start time, then merge overlapping/adjacent
  clipped.sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: { start: Date; end: Date }[] = []
  for (const c of clipped) {
    const last = merged[merged.length - 1]
    if (last && c.start <= last.end) {
      if (c.end > last.end) last.end = c.end
    } else {
      merged.push({ start: c.start, end: c.end })
    }
  }

  // Build free slots from the gaps
  const slots: FreeSlot[] = []
  let cursor = blockStart
  for (const m of merged) {
    if (cursor < m.start) {
      const mins = differenceInMinutes(m.start, cursor)
      if (mins > 0) slots.push({ start: new Date(cursor), end: new Date(m.start), minutes: mins })
    }
    cursor = m.end
  }
  if (cursor < blockEnd) {
    const mins = differenceInMinutes(blockEnd, cursor)
    if (mins > 0) slots.push({ start: new Date(cursor), end: new Date(blockEnd), minutes: mins })
  }

  return slots
}

export function generateFrameInstances(
  frames: Frame[],
  startDate: Date,
  endDate: Date,
  existingBlocks: { start: Date; end: Date }[],
): FrameInstance[] {
  const instances: FrameInstance[] = []
  const start = startOfDay(startDate)
  const end = startOfDay(endDate)

  let current = start
  while (current <= end) {
    const dayOfWeek = current.getDay()
    const dateStr = format(current, 'yyyy-MM-dd')

    for (const frame of frames) {
      if (!frame.is_active) continue

      if (dateStr in frame.day_overrides && !frame.day_overrides[dateStr]) {
        continue
      }

      for (const block of frame.time_blocks) {
        if (block.day !== dayOfWeek) continue

        const blockStart = parseTimeToDate(current, block.start)
        const blockEnd = parseTimeToDate(current, block.end)
        const totalMinutes = differenceInMinutes(blockEnd, blockStart)
        if (totalMinutes <= 0) continue

        const freeSlots = computeFreeSlots(blockStart, blockEnd, existingBlocks)
        const availableMinutes = freeSlots.reduce((sum, s) => sum + s.minutes, 0)
        if (availableMinutes <= 0) continue

        instances.push({
          frame,
          date: dateStr,
          start: blockStart,
          end: blockEnd,
          availableMinutes,
          freeSlots,
        })
      }
    }

    current = addDays(current, 1)
  }

  instances.sort((a, b) => {
    const dateCompare = a.start.getTime() - b.start.getTime()
    if (dateCompare !== 0) return dateCompare
    return a.frame.priority_rank - b.frame.priority_rank
  })

  return instances
}

export function placeTasks(
  scoredTasks: ScoredTask[],
  frameInstances: FrameInstance[],
  classifications: Map<string, string>,
): AutoSchedulePlacement[] {
  const placements: AutoSchedulePlacement[] = []

  // Deep-copy free slots per instance so placement can consume from them
  const remainingSlots: FreeSlot[][] = frameInstances.map((fi) =>
    fi.freeSlots.map((s) => ({ start: new Date(s.start), end: new Date(s.end), minutes: s.minutes })),
  )

  // Pre-build index: frameId -> list of instance indices
  const frameIndex = new Map<string, number[]>()
  for (let i = 0; i < frameInstances.length; i++) {
    const fid = frameInstances[i]!.frame.id
    let list = frameIndex.get(fid)
    if (!list) {
      list = []
      frameIndex.set(fid, list)
    }
    list.push(i)
  }

  const allIndices: number[] = []
  for (let i = 0; i < frameInstances.length; i++) allIndices.push(i)

  for (const { task, score } of scoredTasks) {
    const duration = Math.max(1, task.time_estimate_minutes ?? 30)
    const classifiedFrameId = classifications.get(task.id)
    const earliestStart = task.earliest_start ? new Date(task.earliest_start) : null
    const dueDate = task.due_date ? new Date(task.due_date) : null

    let candidateIndices: number[]
    if (classifiedFrameId) {
      const preferred = frameIndex.get(classifiedFrameId) ?? []
      const rest: number[] = []
      for (let i = 0; i < frameInstances.length; i++) {
        if (frameInstances[i]!.frame.id !== classifiedFrameId) rest.push(i)
      }
      candidateIndices = preferred.concat(rest)
    } else {
      candidateIndices = allIndices
    }

    let placed = false
    for (let ci = 0; ci < candidateIndices.length && !placed; ci++) {
      const idx = candidateIndices[ci]!
      const instance = frameInstances[idx]!
      const slots = remainingSlots[idx]!

      if (earliestStart && instance.end <= earliestStart) continue
      if (dueDate && instance.start > dueDate) continue

      // Find the first free slot that can fit the task
      for (let si = 0; si < slots.length && !placed; si++) {
        const slot = slots[si]!
        if (slot.minutes < duration) continue
        if (earliestStart && slot.end <= earliestStart) continue
        if (dueDate && slot.start > dueDate) continue

        // Determine effective start within the slot (respect earliestStart)
        const effectiveStart =
          earliestStart && earliestStart > slot.start ? earliestStart : slot.start
        const availableFromStart = differenceInMinutes(slot.end, effectiveStart)
        if (availableFromStart < duration) continue

        const scheduledStart = new Date(effectiveStart)
        const scheduledEnd = new Date(
          scheduledStart.getTime() + duration * 60 * 1000,
        )

        placements.push({
          task_id: task.id,
          task_title: task.title,
          frame_id: instance.frame.id,
          frame_name: instance.frame.name,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          score,
        })

        // Consume the time from this slot: shrink or split
        if (effectiveStart.getTime() === slot.start.getTime()) {
          // Consumed from the beginning of the slot
          slot.start = scheduledEnd
          slot.minutes = differenceInMinutes(slot.end, slot.start)
          if (slot.minutes <= 0) slots.splice(si, 1)
        } else {
          // Gap before the task: split into [slot.start, effectiveStart] + [scheduledEnd, originalEnd]
          const originalEnd = slot.end
          const afterMinutes = differenceInMinutes(originalEnd, scheduledEnd)
          slot.end = effectiveStart
          slot.minutes = differenceInMinutes(slot.end, slot.start)
          if (afterMinutes > 0) {
            slots.splice(si + 1, 0, {
              start: new Date(scheduledEnd),
              end: new Date(originalEnd),
              minutes: afterMinutes,
            })
          }
          if (slot.minutes <= 0) slots.splice(si, 1)
        }

        placed = true
      }
    }
  }

  return placements
}
