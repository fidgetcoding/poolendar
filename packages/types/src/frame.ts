export interface Frame {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  time_blocks: FrameTimeBlock[]
  recurrence_rule: string | null
  is_active: boolean
  day_overrides: Record<string, boolean>
  priority_rank: number
  created_at: string
  updated_at: string
}

export interface FrameTimeBlock {
  day: number      // 0=Sun, 1=Mon, ..., 6=Sat
  start: string    // "09:00"
  end: string      // "11:00"
}

export interface FrameKeyword {
  id: string
  user_id: string
  frame_id: string
  keyword: string
  weight: number
  source: 'seed' | 'correction' | 'llm'
  created_at: string
}

export interface FrameCorrection {
  id: string
  user_id: string
  task_id: string | null
  from_frame_id: string | null
  to_frame_id: string | null
  task_title: string
  created_at: string
}

export interface AutoScheduleStatus {
  enabled: boolean
  last_run_at: string | null
  scheduled_count: number
  unscheduled_count: number
}

export interface AutoSchedulePlacement {
  task_id: string
  task_title: string
  frame_id: string
  frame_name: string
  scheduled_start: string
  scheduled_end: string
  score: number
}

export interface TaskClassification {
  frame_id: string | null
  frame_name: string | null
  confidence: number
  layer: 'keyword' | 'llm' | 'none'
}

export interface AutoScheduleWeights {
  urgency: number
  deadline: number
  tag_priority: number
  staleness: number
}
