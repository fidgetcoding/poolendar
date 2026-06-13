import { z } from 'zod'

export const convertSchema = z.object({
  source_type: z.enum(['event', 'task', 'routine']),
  source_id: z.string().uuid(),
  target_type: z.enum(['event', 'task', 'routine']),
  calendar_id: z.string().uuid().optional(),
  repeat_pattern: z.string().optional(),
}).refine(
  (data) => data.source_type !== data.target_type,
  { message: 'source_type and target_type must be different' }
)
