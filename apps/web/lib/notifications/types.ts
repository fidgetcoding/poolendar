export type NotificationChannel = 'browser_push' | 'email' | 'in_app' | 'telegram'

export type NotificationEvent =
  | 'reminder'
  | 'due_date'
  | 'booking'
  | 'schedule_change'
  | 'event_reminder'
  | 'task_reminder'
  | 'routine_reminder'

export interface NotificationPayload {
  title: string
  body: string
  event: NotificationEvent
  url?: string
  data?: Record<string, unknown>
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  created_at: string
}

export const EVENT_TO_SETTINGS_KEY: Record<NotificationEvent, string> = {
  reminder: 'reminders',
  event_reminder: 'reminders',
  task_reminder: 'reminders',
  routine_reminder: 'reminders',
  due_date: 'due_dates',
  booking: 'bookings',
  schedule_change: 'schedule_changes',
}
