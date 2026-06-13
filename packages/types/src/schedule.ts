export interface Schedule {
  id: string
  user_id: string
  name: string
  time_blocks: { day: string; start: string; end: string }[]
  created_at: string
  updated_at: string
}
