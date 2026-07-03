import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PoolendarClient } from '@poolendar/api-client'

/**
 * Tests the PoolendarClient wrapper used by the MCP server.
 * Mocks global fetch to verify request construction and response handling.
 */

// Helpers
function mockFetchResponse(body: unknown, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(body),
  })
}

function lastFetchCall() {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1]!
}

describe('PoolendarClient', () => {
  const BASE_URL = 'https://app.poolendar.com'
  const API_KEY = 'pk_test_abc123'

  let client: PoolendarClient

  beforeEach(() => {
    client = new PoolendarClient({ baseUrl: BASE_URL, apiKey: API_KEY })
    globalThis.fetch = mockFetchResponse({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---- Constructor ----

  describe('constructor', () => {
    it('strips trailing slash from baseUrl', () => {
      const c = new PoolendarClient({ baseUrl: 'https://example.com/', apiKey: 'pk_x' })
      // Verify by making a request
      globalThis.fetch = mockFetchResponse([])
      c.listTags()
      const [url] = lastFetchCall()
      expect(url).toBe('https://example.com/api/tags')
    })

    it('sets Authorization header with apiKey', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listTags()
      const [, opts] = lastFetchCall()
      expect(opts.headers.Authorization).toBe(`Bearer ${API_KEY}`)
    })

    it('sets Authorization header with token if provided', async () => {
      const tokenClient = new PoolendarClient({
        baseUrl: BASE_URL,
        token: 'session_token_xyz',
      })
      globalThis.fetch = mockFetchResponse([])
      await tokenClient.listTags()
      const [, opts] = lastFetchCall()
      expect(opts.headers.Authorization).toBe('Bearer session_token_xyz')
    })

    it('sets Content-Type to application/json', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listTags()
      const [, opts] = lastFetchCall()
      expect(opts.headers['Content-Type']).toBe('application/json')
    })
  })

  // ---- Request construction ----

  describe('GET requests', () => {
    it('includes Authorization header', async () => {
      globalThis.fetch = mockFetchResponse({ id: '1', name: 'Test' })
      await client.getTag('tag-1')
      const [, opts] = lastFetchCall()
      expect(opts.headers.Authorization).toBe(`Bearer ${API_KEY}`)
    })

    it('does not include a body', async () => {
      globalThis.fetch = mockFetchResponse({ id: '1', name: 'Test' })
      await client.getTag('tag-1')
      const [, opts] = lastFetchCall()
      expect(opts.body).toBeUndefined()
    })
  })

  describe('POST requests', () => {
    it('sends JSON body', async () => {
      globalThis.fetch = mockFetchResponse({ id: '1', title: 'New Task' })
      await client.createTask({ title: 'New Task' } as any)
      const [, opts] = lastFetchCall()
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ title: 'New Task' })
    })
  })

  describe('PATCH requests', () => {
    it('sends partial update body', async () => {
      globalThis.fetch = mockFetchResponse({ id: '1', title: 'Updated' })
      await client.updateTask('task-1', { title: 'Updated' } as any)
      const [, opts] = lastFetchCall()
      expect(opts.method).toBe('PATCH')
      expect(JSON.parse(opts.body)).toEqual({ title: 'Updated' })
    })
  })

  describe('DELETE requests', () => {
    it('uses DELETE method', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      // deleteTask returns void so json() might throw. Mock it properly.
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: vi.fn().mockResolvedValue(undefined),
      })
      await client.deleteTask('task-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/task-1`)
      expect(opts.method).toBe('DELETE')
    })
  })

  // ---- Error handling ----

  describe('error handling', () => {
    it('throws on 4xx response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: vi.fn().mockResolvedValue({ error: 'Task not found' }),
      })
      await expect(client.getTask('nonexistent')).rejects.toThrow('Task not found')
    })

    it('throws on 5xx response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: vi.fn().mockResolvedValue({ error: 'Database connection failed' }),
      })
      await expect(client.listTasks()).rejects.toThrow('Database connection failed')
    })

    it('uses statusText as fallback when JSON body has no error field', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: vi.fn().mockResolvedValue({}),
      })
      await expect(client.listTasks()).rejects.toThrow('Bad Gateway')
    })

    it('handles non-JSON error bodies gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      })
      await expect(client.listTasks()).rejects.toThrow('Service Unavailable')
    })

    it('thrown error has status property', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: vi.fn().mockResolvedValue({ error: 'Validation failed' }),
      })
      try {
        await client.createTask({ title: '' } as any)
        expect.fail('Should have thrown')
      } catch (err: any) {
        expect(err.status).toBe(422)
      }
    })
  })

  // ---- Endpoint mapping ----

  describe('endpoint mapping', () => {
    beforeEach(() => {
      globalThis.fetch = mockFetchResponse([])
    })

    // Events
    it('listEvents -> GET /api/events with query params', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listEvents({ start: '2026-06-01', end: '2026-06-07' })
      const [url] = lastFetchCall()
      expect(url).toContain('/api/events')
      expect(url).toContain('start=2026-06-01')
      expect(url).toContain('end=2026-06-07')
    })

    it('getEvent -> GET /api/events/:id', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.getEvent('evt-1')
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/events/evt-1`)
    })

    it('createEvent -> POST /api/events', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.createEvent({ title: 'Test' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/events`)
      expect(opts.method).toBe('POST')
    })

    it('updateEvent -> PATCH /api/events/:id', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.updateEvent('evt-1', { title: 'Updated' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/events/evt-1`)
      expect(opts.method).toBe('PATCH')
    })

    it('deleteEvent -> DELETE /api/events/:id', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteEvent('evt-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/events/evt-1`)
      expect(opts.method).toBe('DELETE')
    })

    it('rsvpEvent -> POST /api/events/:id/rsvp', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.rsvpEvent('evt-1', { response: 'accepted' })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/events/evt-1/rsvp`)
      expect(opts.method).toBe('POST')
    })

    // Tasks
    it('listTasks -> GET /api/tasks', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listTasks()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks`)
    })

    it('listTasks with filters -> GET /api/tasks?status=...&board=...', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listTasks({ status: 'backlog', board: 'current' })
      const [url] = lastFetchCall()
      expect(url).toContain('status=backlog')
      expect(url).toContain('board=current')
    })

    it('createTask -> POST /api/tasks', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.createTask({ title: 'Test' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks`)
      expect(opts.method).toBe('POST')
    })

    it('updateTask -> PATCH /api/tasks/:id', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.updateTask('t-1', { title: 'Up' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1`)
      expect(opts.method).toBe('PATCH')
    })

    it('deleteTask -> DELETE /api/tasks/:id', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteTask('t-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1`)
      expect(opts.method).toBe('DELETE')
    })

    it('moveTask -> POST /api/tasks/:id/move', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.moveTask('t-1', { status: 'done', position: 1 })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/move`)
      expect(opts.method).toBe('POST')
    })

    it('splitTask -> POST /api/tasks/:id/split', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.splitTask('t-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/split`)
      expect(opts.method).toBe('POST')
    })

    it('scheduleTask -> POST /api/tasks/:id/schedule', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.scheduleTask('t-1', {
        scheduled_start: '2026-06-15T14:00:00Z',
        scheduled_end: '2026-06-15T15:00:00Z',
      })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/schedule`)
      expect(opts.method).toBe('POST')
    })

    it('completeTask -> POST /api/tasks/:id/complete', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.completeTask('t-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/complete`)
      expect(opts.method).toBe('POST')
    })

    it('reopenTask -> POST /api/tasks/:id/reopen', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.reopenTask('t-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/reopen`)
      expect(opts.method).toBe('POST')
    })

    // Subtasks
    it('listSubtasks -> GET /api/tasks/:id/subtasks', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listSubtasks('t-1')
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/subtasks`)
    })

    it('createSubtask -> POST /api/tasks/:id/subtasks', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.createSubtask('t-1', { title: 'Sub' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/subtasks`)
      expect(opts.method).toBe('POST')
    })

    it('updateSubtask -> PATCH /api/tasks/:tid/subtasks/:sid', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.updateSubtask('t-1', 'sub-1', { completed: true } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/subtasks/sub-1`)
      expect(opts.method).toBe('PATCH')
    })

    it('deleteSubtask -> DELETE /api/tasks/:tid/subtasks/:sid', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteSubtask('t-1', 'sub-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/subtasks/sub-1`)
      expect(opts.method).toBe('DELETE')
    })

    it('reorderSubtasks -> POST /api/tasks/:id/subtasks/reorder', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.reorderSubtasks('t-1', ['sub-2', 'sub-1'])
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tasks/t-1/subtasks/reorder`)
      expect(opts.method).toBe('POST')
      // The reorder route expects `subtask_ids`, not `order`.
      expect(JSON.parse(opts.body)).toEqual({ subtask_ids: ['sub-2', 'sub-1'] })
    })

    // Routines
    it('listRoutines -> GET /api/routines', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listRoutines()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/routines`)
    })

    it('createRoutine -> POST /api/routines', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.createRoutine({ title: 'Daily standup' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/routines`)
      expect(opts.method).toBe('POST')
    })

    it('deleteRoutine -> DELETE /api/routines/:id', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteRoutine('r-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/routines/r-1`)
      expect(opts.method).toBe('DELETE')
    })

    // Tags
    it('listTags -> GET /api/tags', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listTags()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tags`)
    })

    it('createTag -> POST /api/tags', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.createTag({ name: 'URGENT', color: '#FF0000' })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/tags`)
      expect(opts.method).toBe('POST')
    })

    // Booking Links
    it('listBookingLinks -> GET /api/booking-links', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listBookingLinks()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/booking-links`)
    })

    it('bookSlot -> POST /api/booking/book/:slug', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.bookSlot('intro-call', {
        booker_name: 'Alice',
        booker_email: 'alice@example.com',
        start_time: '2026-06-15T14:00:00Z',
      })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/booking/book/intro-call`)
      expect(opts.method).toBe('POST')
    })

    it('getAvailability -> GET /api/booking/availability/:slug?...', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.getAvailability('intro-call', {
        start: '2026-06-15',
        end: '2026-06-15',
        timezone: 'America/New_York',
      })
      const [url] = lastFetchCall()
      expect(url).toContain('/api/booking/availability/intro-call')
      expect(url).toContain('timezone=America')
    })

    it('listBookings -> GET /api/booking/bookings?link_id=', async () => {
      globalThis.fetch = mockFetchResponse({ items: [], next_cursor: null })
      await client.listBookings('bl-1')
      const [url] = lastFetchCall()
      expect(url).toContain('/api/booking/bookings')
      expect(url).toContain('link_id=bl-1')
    })

    // Schedules
    it('listSchedules -> GET /api/schedules', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listSchedules()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/schedules`)
    })

    // Convert
    it('convert -> POST /api/convert', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.convert({
        source_type: 'task',
        source_id: 't-1',
        target_type: 'event',
      })
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/convert`)
      expect(opts.method).toBe('POST')
    })

    // Search
    it('search -> GET /api/search?q=...', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.search('meeting')
      const [url] = lastFetchCall()
      expect(url).toContain('/api/search')
      expect(url).toContain('q=meeting')
    })

    it('search with types filter -> GET /api/search?q=...&types=...', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.search('standup', ['event', 'routine'])
      const [url] = lastFetchCall()
      expect(url).toContain('q=standup')
      expect(url).toContain('types=event%2Croutine')
    })

    // Profile
    it('getProfile -> GET /api/profile', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.getProfile()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/profile`)
    })

    it('updateProfile -> PATCH /api/profile', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.updateProfile({ username: 'nate' } as any)
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/profile`)
      expect(opts.method).toBe('PATCH')
    })

    // Undo
    it('undo -> POST /api/undo', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.undo()
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/undo`)
      expect(opts.method).toBe('POST')
    })

    // Google Sync
    it('triggerGoogleSync -> POST /api/google/sync', async () => {
      globalThis.fetch = mockFetchResponse({})
      await client.triggerGoogleSync()
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/google/sync`)
      expect(opts.method).toBe('POST')
    })

    // API Keys
    it('listApiKeys -> GET /api/api-keys', async () => {
      globalThis.fetch = mockFetchResponse([])
      await client.listApiKeys()
      const [url] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/api-keys`)
    })

    it('createApiKey -> POST /api/api-keys', async () => {
      globalThis.fetch = mockFetchResponse({ id: 'k-1', key: 'pk_live_xxx' })
      await client.createApiKey('Claude Code')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/api-keys`)
      expect(opts.method).toBe('POST')
      expect(JSON.parse(opts.body)).toEqual({ name: 'Claude Code' })
    })

    it('deleteApiKey -> DELETE /api/api-keys/:id', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteApiKey('k-1')
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/api-keys/k-1`)
      expect(opts.method).toBe('DELETE')
    })

    // Delete Account
    it('deleteAccount -> DELETE /api/auth/delete-account', async () => {
      globalThis.fetch = mockFetchResponse(undefined)
      await client.deleteAccount()
      const [url, opts] = lastFetchCall()
      expect(url).toBe(`${BASE_URL}/api/auth/delete-account`)
      expect(opts.method).toBe('DELETE')
    })
  })

  // ---- Method existence ----

  describe('all CRUD methods exist', () => {
    const expectedMethods = [
      // Events
      'listEvents', 'getEvent', 'createEvent', 'updateEvent', 'deleteEvent', 'rsvpEvent',
      // Tasks
      'listTasks', 'getTask', 'createTask', 'updateTask', 'deleteTask',
      'moveTask', 'splitTask', 'scheduleTask', 'completeTask', 'reopenTask',
      // Subtasks
      'listSubtasks', 'createSubtask', 'updateSubtask', 'deleteSubtask', 'reorderSubtasks',
      // Routines
      'listRoutines', 'getRoutine', 'createRoutine', 'updateRoutine', 'deleteRoutine',
      'listRoutineInstances', 'updateRoutineInstance',
      // Tags
      'listTags', 'getTag', 'createTag', 'updateTag', 'deleteTag',
      // Booking
      'listBookingLinks', 'getBookingLink', 'createBookingLink',
      'updateBookingLink', 'deleteBookingLink',
      'listBookings', 'bookSlot', 'getAvailability',
      // Schedules
      'listSchedules', 'getSchedule', 'createSchedule', 'updateSchedule', 'deleteSchedule',
      // Convert
      'convert',
      // Search
      'search',
      // Profile
      'getProfile', 'updateProfile',
      // Account
      'deleteAccount',
      // API Keys
      'listApiKeys', 'createApiKey', 'deleteApiKey',
      // Misc
      'undo', 'triggerGoogleSync',
    ]

    for (const method of expectedMethods) {
      it(`has ${method}()`, () => {
        expect(typeof (client as any)[method]).toBe('function')
      })
    }
  })
})
