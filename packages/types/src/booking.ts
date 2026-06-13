export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled'

export interface WeeklyAvailability {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  start: string
  end: string
}

export interface AvailabilitySlot {
  start: string
  end: string
}

export interface BookingLink {
  id: string
  user_id: string
  slug: string
  name: string
  duration_minutes: number
  availability: WeeklyAvailability[]
  timezone: string
  google_account_id: string | null
  conferencing: boolean
  location: string | null
  notes: string | null
  is_public: boolean
  requires_approval: boolean
  buffer_minutes: number
  minimum_notice_hours: number
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  booking_link_id: string
  booker_name: string
  booker_email: string
  booker_notes: string | null
  start_time: string
  end_time: string
  status: BookingStatus
  google_event_id: string | null
  cancel_token: string
  created_at: string
}
