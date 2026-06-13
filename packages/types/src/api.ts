export type ConvertDirection =
  | 'event_to_task'
  | 'event_to_routine'
  | 'task_to_event'
  | 'task_to_routine'
  | 'routine_to_task'
  | 'routine_to_event'

export interface ConvertRequest {
  source_type: 'event' | 'task' | 'routine'
  source_id: string
  target_type: 'event' | 'task' | 'routine'
  calendar_id?: string
  repeat_pattern?: string
}

export interface SearchResult {
  type: 'event' | 'task' | 'routine' | 'booking_link'
  id: string
  title: string
  date: string | null
  snippet: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  cursor: string | null
  has_more: boolean
  total_count: number
}

export interface ApiError {
  error: string
  message: string
  status: number
  details?: Record<string, string[]>
}
