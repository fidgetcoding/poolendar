import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().max(10000).nullable().optional(),
  calendar_id: z.string().uuid().nullable().optional(),
  importance: z.enum(['lowest', 'low', 'normal', 'high', 'highest']).default('normal'),
  time_estimate_minutes: z.number().int().positive().nullable().optional(),
  earliest_start: z.string().date().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
  due_date_recurrence: z.string().nullable().optional(),
  scheduled_start: z.string().datetime().nullable().optional(),
  scheduled_end: z.string().datetime().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  visibility: z.enum(['busy', 'free']).default('busy'),
  privacy: z.enum(['private', 'public']).default('private'),
  flexibility: z.enum(['flexible', 'not_flexible']).default('flexible'),
  status: z.enum(['backlog', 'in_progress', 'check', 'done']).default('backlog'),
  board: z.enum(['current', 'future']).default('current'),
  tag_ids: z.array(z.string().uuid()).default([]),
  reminders: z.array(z.object({ minutes_before: z.number().int().positive() })).default([]),
  subtasks: z.array(z.object({
    title: z.string().min(1).max(500),
    time_estimate_minutes: z.number().int().positive().nullable().optional(),
  })).optional(),
})

export const updateTaskSchema = createTaskSchema.partial()

export const moveTaskSchema = z.object({
  status: z.enum(['backlog', 'in_progress', 'check', 'done']),
  board: z.enum(['current', 'future']).optional(),
  position: z.number().optional(),
})

export const splitTaskSchema = z.object({
  chunks: z.number().int().min(2).max(20).optional(),
})

export const scheduleTaskSchema = z.object({
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
})

export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(500),
  time_estimate_minutes: z.number().int().positive().nullable().optional(),
})

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  time_estimate_minutes: z.number().int().positive().nullable().optional(),
  completed: z.boolean().optional(),
})

export const reorderSubtasksSchema = z.object({
  subtask_ids: z.array(z.string().uuid()),
})
