import { z } from 'zod'

const frameTimeBlockSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
})

export const createFrameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  time_blocks: z.array(frameTimeBlockSchema).min(1),
  recurrence_rule: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  priority_rank: z.number().int().min(0).default(0),
})

export const updateFrameSchema = createFrameSchema.partial()

export const frameOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean(),
})

export const autoScheduleRunSchema = z.object({
  confirm: z.boolean().default(false),
  window_days: z.number().int().min(1).max(30).default(7),
})

export const classifyTaskSchema = z.object({
  task_id: z.string().uuid(),
})

export const autoScheduleWeightsSchema = z.object({
  urgency: z.number().min(0).max(1),
  deadline: z.number().min(0).max(1),
  tag_priority: z.number().min(0).max(1),
  staleness: z.number().min(0).max(1),
})
