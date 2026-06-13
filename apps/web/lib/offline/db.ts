import Dexie, { type Table } from 'dexie'

// ---------------------------------------------------------------------------
// Interfaces — mirror Supabase tables for offline use
// ---------------------------------------------------------------------------

export interface OfflineEvent {
  id: string
  user_id: string
  calendar_id: string
  google_event_id: string | null
  title: string
  notes: string | null
  start_time: string
  end_time: string
  timezone: string
  is_all_day: boolean
  location: string | null
  color_override: string | null
  visibility: string
  privacy: string
  conferencing_url: string | null
  recurrence_rule: string | null
  attendees: unknown[]
  reminders: unknown[]
  status: string
  sync_status: string
  etag: string | null
  created_at: string
  updated_at: string
}

export interface OfflineTask {
  id: string
  user_id: string
  calendar_id: string | null
  parent_id: string | null
  title: string
  notes: string | null
  importance: string
  time_estimate_minutes: number | null
  earliest_start: string | null
  due_date: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  status: string
  board: string
  is_split: boolean
  completed_at: string | null
  position: number | null
  reminders: unknown[]
  created_at: string
  updated_at: string
}

export interface OfflineSubtask {
  id: string
  task_id: string
  title: string
  time_estimate_minutes: number | null
  completed: boolean
  position: number
  created_at: string
}

export interface OfflineRoutine {
  id: string
  user_id: string
  title: string
  notes: string | null
  start_time: string
  end_time: string
  timezone: string
  recurrence_rule: string
  location: string | null
  visibility: string
  privacy: string
  reminders: unknown[]
  created_at: string
  updated_at: string
}

export interface OfflineRoutineInstance {
  id: string
  routine_id: string
  date: string
  status: string
  completed_at: string | null
}

export interface MutationQueueEntry {
  id?: number
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  table: string
  entityId: string
  data: Record<string, unknown> | null
  timestamp: number
  retries: number
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class PoolendarDB extends Dexie {
  events!: Table<OfflineEvent, string>
  tasks!: Table<OfflineTask, string>
  subtasks!: Table<OfflineSubtask, string>
  routines!: Table<OfflineRoutine, string>
  routineInstances!: Table<OfflineRoutineInstance, string>
  mutationQueue!: Table<MutationQueueEntry, number>

  constructor() {
    super('PoolendarDB')

    this.version(1).stores({
      events:
        'id, [user_id+start_time], [user_id+end_time], calendar_id, google_event_id',
      tasks:
        'id, [user_id+status+board], parent_id, [user_id+scheduled_start], [user_id+due_date]',
      subtasks: 'id, task_id, [task_id+position]',
      routines: 'id, user_id',
      routineInstances: 'id, [routine_id+date]',
      mutationQueue: '++id, timestamp',
    })
  }
}

export const db = new PoolendarDB()
