import { z } from 'zod'

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  types: z.array(z.enum(['event', 'task', 'routine', 'booking_link'])).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
})
