import type { Task, AutoScheduleWeights } from '@poolendar/types'

export interface ScoredTask {
  task: Task
  score: number
  components: {
    urgency: number
    deadline: number
    tag_priority: number
    staleness: number
  }
}

const IMPORTANCE_MAP: Record<string, number> = {
  highest: 5,
  high: 4,
  normal: 3,
  low: 2,
  lowest: 1,
}

export const DEFAULT_WEIGHTS: AutoScheduleWeights = {
  urgency: 0.35,
  deadline: 0.30,
  tag_priority: 0.20,
  staleness: 0.15,
}

export function scoreTask(
  task: Task,
  weights: AutoScheduleWeights,
  now: Date = new Date(),
): ScoredTask {
  const urgency = ((IMPORTANCE_MAP[task.importance] ?? 3) - 1) / 4

  let deadline = 0
  if (task.due_date) {
    const dueDate = new Date(task.due_date)
    const daysUntil = Math.max(
      0,
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )
    deadline = Math.max(0, 1 - daysUntil / 14)
  }

  let tagPriority = 0.5
  if (task.tags?.length) {
    // Lower priority_rank = higher priority (rank 1 is top), so use Math.min
    const bestRank = Math.min(...task.tags.map((t) => t.priority_rank ?? 5))
    // Invert: rank 1 → score 1.0, rank 10 → score 0.0
    tagPriority = Math.max(0, Math.min(1, (10 - bestRank) / 9))
  }

  const daysSinceCreation = Math.max(
    0,
    (now.getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24),
  )
  const staleness = Math.min(1, daysSinceCreation / 30)

  const score =
    weights.urgency * urgency +
    weights.deadline * deadline +
    weights.tag_priority * tagPriority +
    weights.staleness * staleness

  return {
    task,
    score,
    components: { urgency, deadline, tag_priority: tagPriority, staleness },
  }
}

export function scoreTasks(
  tasks: Task[],
  weights: AutoScheduleWeights,
  now?: Date,
): ScoredTask[] {
  return tasks
    .map((t) => scoreTask(t, weights, now))
    .sort((a, b) => b.score - a.score)
}
