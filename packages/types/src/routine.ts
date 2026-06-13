export type RoutineInstanceStatus = 'pending' | 'completed' | 'skipped'

export interface Routine {
  id: string
  user_id: string
  calendar_id: string | null
  title: string
  notes: string | null
  start_time: string
  end_time: string
  timezone: string
  recurrence_rule: string
  location: string | null
  visibility: 'busy' | 'free'
  privacy: 'private' | 'public'
  reminders: { minutes_before: number }[]
  created_at: string
  updated_at: string
}

export interface RoutineInstance {
  id: string
  routine_id: string
  date: string
  status: RoutineInstanceStatus
  completed_at: string | null
  override_start_time: string | null
  override_end_time: string | null
  override_title: string | null
}
