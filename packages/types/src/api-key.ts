export interface ApiKey {
  id: string
  user_id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}
