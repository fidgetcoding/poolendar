import type {
  CalendarEvent,
  Task,
  Routine,
  BookingLink,
  Booking,
  Tag,
  Schedule,
  Subtask,
  Profile,
  ApiKey,
  PaginatedResponse,
  SearchResult,
} from '@poolendar/types'

export interface ClientConfig {
  baseUrl: string
  apiKey?: string
  token?: string
}

export class PoolendarClient {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.headers = { 'Content-Type': 'application/json' }
    if (config.apiKey) this.headers['Authorization'] = `Bearer ${config.apiKey}`
    if (config.token) this.headers['Authorization'] = `Bearer ${config.token}`
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(res.status, body.error ?? res.statusText)
    }
    return res.json()
  }

  // Events
  async listEvents(params?: { start?: string; end?: string; calendar_id?: string }) {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<CalendarEvent[]>(`/api/events${q ? `?${q}` : ''}`)
  }
  async getEvent(id: string) { return this.request<CalendarEvent>(`/api/events/${id}`) }
  async createEvent(data: Partial<CalendarEvent>) { return this.request<CalendarEvent>('/api/events', { method: 'POST', body: JSON.stringify(data) }) }
  async updateEvent(id: string, data: Partial<CalendarEvent>) { return this.request<CalendarEvent>(`/api/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteEvent(id: string) { return this.request<void>(`/api/events/${id}`, { method: 'DELETE' }) }

  // Tasks
  async listTasks(params?: { status?: string; board?: string }) {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<Task[]>(`/api/tasks${q ? `?${q}` : ''}`)
  }
  async getTask(id: string) { return this.request<Task>(`/api/tasks/${id}`) }
  async createTask(data: Partial<Task>) { return this.request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }) }
  async updateTask(id: string, data: Partial<Task>) { return this.request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteTask(id: string) { return this.request<void>(`/api/tasks/${id}`, { method: 'DELETE' }) }
  async moveTask(id: string, data: { status: string; position: number }) { return this.request<Task>(`/api/tasks/${id}/move`, { method: 'POST', body: JSON.stringify(data) }) }
  async splitTask(id: string) { return this.request<Task[]>(`/api/tasks/${id}/split`, { method: 'POST' }) }
  async scheduleTask(id: string, data: { scheduled_start: string; scheduled_end: string }) { return this.request<Task>(`/api/tasks/${id}/schedule`, { method: 'POST', body: JSON.stringify(data) }) }

  // Subtasks
  async listSubtasks(taskId: string) { return this.request<Subtask[]>(`/api/tasks/${taskId}/subtasks`) }
  async createSubtask(taskId: string, data: Partial<Subtask>) { return this.request<Subtask>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(data) }) }
  async updateSubtask(taskId: string, subtaskId: string, data: Partial<Subtask>) { return this.request<Subtask>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteSubtask(taskId: string, subtaskId: string) { return this.request<void>(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' }) }
  async reorderSubtasks(taskId: string, order: string[]) { return this.request<Subtask[]>(`/api/tasks/${taskId}/subtasks/reorder`, { method: 'POST', body: JSON.stringify({ order }) }) }

  // Routines
  async listRoutines() { return this.request<Routine[]>('/api/routines') }
  async getRoutine(id: string) { return this.request<Routine>(`/api/routines/${id}`) }
  async createRoutine(data: Partial<Routine>) { return this.request<Routine>('/api/routines', { method: 'POST', body: JSON.stringify(data) }) }
  async updateRoutine(id: string, data: Partial<Routine>) { return this.request<Routine>(`/api/routines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteRoutine(id: string) { return this.request<void>(`/api/routines/${id}`, { method: 'DELETE' }) }

  // Tags
  async listTags() { return this.request<Tag[]>('/api/tags') }
  async createTag(data: { name: string; color: string }) { return this.request<Tag>('/api/tags', { method: 'POST', body: JSON.stringify(data) }) }
  async updateTag(id: string, data: Partial<Tag>) { return this.request<Tag>(`/api/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteTag(id: string) { return this.request<void>(`/api/tags/${id}`, { method: 'DELETE' }) }

  // Booking Links
  async listBookingLinks() { return this.request<BookingLink[]>('/api/booking-links') }
  async createBookingLink(data: Partial<BookingLink>) { return this.request<BookingLink>('/api/booking-links', { method: 'POST', body: JSON.stringify(data) }) }
  async updateBookingLink(id: string, data: Partial<BookingLink>) { return this.request<BookingLink>(`/api/booking-links/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteBookingLink(id: string) { return this.request<void>(`/api/booking-links/${id}`, { method: 'DELETE' }) }

  // Bookings
  async listBookings(linkId: string) { return this.request<Booking[]>(`/api/booking-links/${linkId}/bookings`) }
  async bookSlot(linkId: string, data: { booker_name: string; booker_email: string; start_time: string }) { return this.request<Booking>(`/api/booking-links/${linkId}/book`, { method: 'POST', body: JSON.stringify(data) }) }

  // Schedules
  async listSchedules() { return this.request<Schedule[]>('/api/schedules') }
  async createSchedule(data: Partial<Schedule>) { return this.request<Schedule>('/api/schedules', { method: 'POST', body: JSON.stringify(data) }) }
  async updateSchedule(id: string, data: Partial<Schedule>) { return this.request<Schedule>(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }) }
  async deleteSchedule(id: string) { return this.request<void>(`/api/schedules/${id}`, { method: 'DELETE' }) }

  // Convert
  async convert(data: { source_type: string; source_id: string; target_type: string }) { return this.request<CalendarEvent | Task | Routine>('/api/convert', { method: 'POST', body: JSON.stringify(data) }) }

  // Search
  async search(q: string, types?: string[]) {
    const params = new URLSearchParams({ q })
    types?.forEach(t => params.append('types', t))
    return this.request<SearchResult[]>(`/api/search?${params}`)
  }

  // Profile
  async getProfile() { return this.request<Profile>('/api/profile') }
  async updateProfile(data: Partial<Profile>) { return this.request<Profile>('/api/profile', { method: 'PATCH', body: JSON.stringify(data) }) }

  // API Keys
  async listApiKeys() { return this.request<ApiKey[]>('/api/api-keys') }
  async createApiKey(name: string) { return this.request<ApiKey & { key: string }>('/api/api-keys', { method: 'POST', body: JSON.stringify({ name }) }) }
  async deleteApiKey(id: string) { return this.request<void>(`/api/api-keys/${id}`, { method: 'DELETE' }) }
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}
