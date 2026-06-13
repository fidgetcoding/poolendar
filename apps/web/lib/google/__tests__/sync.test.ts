import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CalendarEvent, Calendar } from '@poolendar/types'

// ── Calendar module mock ───────────────────────────────────────────────────────

const mockCreateGoogleEvent = vi.fn()
const mockUpdateGoogleEvent = vi.fn()
const mockDeleteGoogleEvent = vi.fn()
const mockListGoogleEvents = vi.fn()
const mockGetGoogleAccessToken = vi.fn()
const mockGoogleCalendarRequest = vi.fn()

vi.mock('../calendar', () => ({
  createGoogleEvent: (...args: any[]) => mockCreateGoogleEvent(...args),
  updateGoogleEvent: (...args: any[]) => mockUpdateGoogleEvent(...args),
  deleteGoogleEvent: (...args: any[]) => mockDeleteGoogleEvent(...args),
  listGoogleEvents: (...args: any[]) => mockListGoogleEvents(...args),
  getGoogleAccessToken: (...args: any[]) => mockGetGoogleAccessToken(...args),
  googleCalendarRequest: (...args: any[]) => mockGoogleCalendarRequest(...args),
}))

// ── Supabase mock ──────────────────────────────────────────────────────────────

const mockSupabaseFrom = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    from: (...args: any[]) => mockSupabaseFrom(...args),
  })),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'local-evt-1',
    user_id: 'user-1',
    calendar_id: 'cal-1',
    google_event_id: null,
    title: 'Test event',
    notes: null,
    start_time: '2026-06-15T09:00:00Z',
    end_time: '2026-06-15T10:00:00Z',
    timezone: 'America/New_York',
    is_all_day: false,
    location: null,
    color_override: null,
    visibility: 'busy',
    privacy: 'public',
    conferencing_url: null,
    recurrence_rule: null,
    recurrence_id: null,
    attendees: [],
    reminders: [],
    status: 'confirmed',
    sync_status: 'pending_push',
    etag: null,
    created_at: '2026-06-15T08:00:00Z',
    updated_at: '2026-06-15T08:00:00Z',
    ...overrides,
  }
}

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: 'cal-1',
    user_id: 'user-1',
    google_account_id: 'acct-1',
    google_calendar_id: 'primary',
    name: 'Main Calendar',
    color: '#4285F4',
    is_primary: true,
    is_active: true,
    access_role: 'owner',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Google Calendar Sync', () => {
  let pushEvent: typeof import('../sync').pushEvent
  let deleteRemoteEvent: typeof import('../sync').deleteRemoteEvent
  let pullChanges: typeof import('../sync').pullChanges
  let handleWebhook: typeof import('../sync').handleWebhook
  let mapGoogleEventToLocal: typeof import('../sync').mapGoogleEventToLocal
  let mapLocalEventToGoogle: typeof import('../sync').mapLocalEventToGoogle

  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()
    ;(globalThis.fetch as any).mockReset()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

    const mod = await import('../sync')
    pushEvent = mod.pushEvent
    deleteRemoteEvent = mod.deleteRemoteEvent
    pullChanges = mod.pullChanges
    handleWebhook = mod.handleWebhook
    mapGoogleEventToLocal = mod.mapGoogleEventToLocal
    mapLocalEventToGoogle = mod.mapLocalEventToGoogle
  })

  // ── mapGoogleEventToLocal ─────────────────────────────────────────────

  describe('mapGoogleEventToLocal()', () => {
    it('maps a timed Google event to local schema', () => {
      const googleEvent = {
        id: 'g-evt-1',
        summary: 'Team sync',
        description: 'Weekly standup',
        start: { dateTime: '2026-06-15T09:00:00-04:00', timeZone: 'America/New_York' },
        end: { dateTime: '2026-06-15T09:30:00-04:00', timeZone: 'America/New_York' },
        etag: '"etag-1"',
        status: 'confirmed',
        location: 'Room 42',
        transparency: 'opaque',
        visibility: 'default',
        attendees: [
          { email: 'a@test.com', displayName: 'Alice', responseStatus: 'accepted' },
        ],
        reminders: {
          overrides: [{ method: 'popup', minutes: 10 }],
        },
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')

      expect(result.google_event_id).toBe('g-evt-1')
      expect(result.title).toBe('Team sync')
      expect(result.notes).toBe('Weekly standup')
      expect(result.timezone).toBe('America/New_York')
      expect(result.is_all_day).toBe(false)
      expect(result.location).toBe('Room 42')
      expect(result.etag).toBe('"etag-1"')
      expect(result.status).toBe('confirmed')
      expect(result.visibility).toBe('busy') // opaque → busy
      expect(result.privacy).toBe('public') // default → public
      expect(result.sync_status).toBe('synced')
      expect(result.attendees).toEqual([
        { email: 'a@test.com', name: 'Alice', response_status: 'accepted' },
      ])
      expect(result.reminders).toEqual([{ minutes_before: 10 }])
    })

    it('maps an all-day event correctly', () => {
      const googleEvent = {
        id: 'g-allday',
        summary: 'Holiday',
        start: { date: '2026-06-20' },
        end: { date: '2026-06-21' },
        etag: '"e"',
        status: 'confirmed',
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')

      expect(result.is_all_day).toBe(true)
      expect(result.start_time).toBe('2026-06-20T00:00:00')
      expect(result.end_time).toBe('2026-06-21T00:00:00')
    })

    it('maps transparent events to free visibility', () => {
      const googleEvent = {
        id: 'g-free',
        summary: 'OOO',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T17:00:00Z' },
        transparency: 'transparent',
        status: 'confirmed',
        etag: '"e"',
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.visibility).toBe('free')
    })

    it('maps private/confidential visibility to private privacy', () => {
      const googleEvent = {
        id: 'g-priv',
        summary: 'Secret',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        visibility: 'private',
        status: 'confirmed',
        etag: '"e"',
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.privacy).toBe('private')
    })

    it('extracts conferencing URL from entryPoints', () => {
      const googleEvent = {
        id: 'g-meet',
        summary: 'Video call',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        status: 'confirmed',
        etag: '"e"',
        conferenceData: {
          entryPoints: [
            { entryPointType: 'video', uri: 'https://meet.google.com/abc-defg-hij' },
          ],
        },
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.conferencing_url).toBe('https://meet.google.com/abc-defg-hij')
    })

    it('falls back to hangoutLink when no entryPoints', () => {
      const googleEvent = {
        id: 'g-hangout',
        summary: 'Hangout',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        status: 'confirmed',
        etag: '"e"',
        hangoutLink: 'https://meet.google.com/old-link',
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.conferencing_url).toBe('https://meet.google.com/old-link')
    })

    it('extracts recurrence rule', () => {
      const googleEvent = {
        id: 'g-recur',
        summary: 'Recurring',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        status: 'confirmed',
        etag: '"e"',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.recurrence_rule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO')
    })

    it('defaults title to (No title) when summary is missing', () => {
      const googleEvent = {
        id: 'g-notitle',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        status: 'confirmed',
        etag: '"e"',
      }

      const result = mapGoogleEventToLocal(googleEvent, 'cal-1', 'user-1')
      expect(result.title).toBe('(No title)')
    })
  })

  // ── mapLocalEventToGoogle ─────────────────────────────────────────────

  describe('mapLocalEventToGoogle()', () => {
    it('maps a timed local event to Google format', () => {
      const event = makeEvent({
        title: 'My meeting',
        notes: 'Discuss Q3',
        location: 'Office',
      })

      const result = mapLocalEventToGoogle(event)

      expect(result.summary).toBe('My meeting')
      expect(result.description).toBe('Discuss Q3')
      expect(result.location).toBe('Office')
      expect(result.start).toEqual({
        dateTime: event.start_time,
        timeZone: 'America/New_York',
      })
      expect(result.transparency).toBe('opaque') // busy → opaque
      expect(result.visibility).toBe('default') // public → default
    })

    it('maps an all-day event with date-only start/end', () => {
      const event = makeEvent({
        is_all_day: true,
        start_time: '2026-06-20T00:00:00',
        end_time: '2026-06-21T00:00:00',
      })

      const result = mapLocalEventToGoogle(event)

      expect(result.start).toEqual({
        date: '2026-06-20',
        timeZone: 'America/New_York',
      })
      expect(result.end).toEqual({
        date: '2026-06-21',
        timeZone: 'America/New_York',
      })
    })

    it('maps free visibility to transparent', () => {
      const event = makeEvent({ visibility: 'free' })
      const result = mapLocalEventToGoogle(event)
      expect(result.transparency).toBe('transparent')
    })

    it('maps private privacy to private visibility', () => {
      const event = makeEvent({ privacy: 'private' })
      const result = mapLocalEventToGoogle(event)
      expect(result.visibility).toBe('private')
    })

    it('includes attendees when present', () => {
      const event = makeEvent({
        attendees: [
          { email: 'bob@test.com', name: 'Bob', response_status: 'accepted' },
        ],
      })

      const result = mapLocalEventToGoogle(event)

      expect(result.attendees).toEqual([
        { email: 'bob@test.com', displayName: 'Bob', responseStatus: 'accepted' },
      ])
    })

    it('includes custom reminders when present', () => {
      const event = makeEvent({
        reminders: [{ minutes_before: 15 }, { minutes_before: 5 }],
      })

      const result = mapLocalEventToGoogle(event)

      expect(result.reminders).toEqual({
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'popup', minutes: 5 },
        ],
      })
    })

    it('uses default reminders when none specified', () => {
      const event = makeEvent({ reminders: [] })
      const result = mapLocalEventToGoogle(event)
      expect(result.reminders).toEqual({ useDefault: true })
    })

    it('prefixes RRULE: to recurrence rules without it', () => {
      const event = makeEvent({ recurrence_rule: 'FREQ=DAILY;COUNT=5' })
      const result = mapLocalEventToGoogle(event)
      expect(result.recurrence).toEqual(['RRULE:FREQ=DAILY;COUNT=5'])
    })

    it('preserves RRULE: prefix if already present', () => {
      const event = makeEvent({
        recurrence_rule: 'RRULE:FREQ=WEEKLY;BYDAY=TU',
      })
      const result = mapLocalEventToGoogle(event)
      expect(result.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=TU'])
    })
  })

  // ── pushEvent ─────────────────────────────────────────────────────────

  describe('pushEvent()', () => {
    it('creates a new Google event when no google_event_id exists', async () => {
      const event = makeEvent({ google_event_id: null })
      const calendar = makeCalendar()

      mockCreateGoogleEvent.mockResolvedValue({
        id: 'new-g-evt',
        etag: '"new-etag"',
      })

      // Mock supabase update + select
      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...event, google_event_id: 'new-g-evt', etag: '"new-etag"', sync_status: 'synced' },
        error: null,
      })
      const mockSelectFn = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEqFn = vi.fn().mockReturnValue({ select: mockSelectFn })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })

      mockSupabaseFrom.mockReturnValue({ update: mockUpdateFn })

      const result = await pushEvent(event, calendar)

      expect(mockCreateGoogleEvent).toHaveBeenCalledWith(
        'acct-1',
        'primary',
        expect.objectContaining({ summary: 'Test event' }),
        false
      )
      expect(result.google_event_id).toBe('new-g-evt')
      expect(result.sync_status).toBe('synced')
    })

    it('updates an existing Google event using PATCH', async () => {
      const event = makeEvent({
        google_event_id: 'existing-g-evt',
        etag: '"old-etag"',
      })
      const calendar = makeCalendar()

      // The push uses updateGoogleEventWithEtag (internal), which calls fetch directly
      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'existing-g-evt',
          etag: '"updated-etag"',
        }),
      })

      mockGetGoogleAccessToken.mockResolvedValue('test-token')

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...event, etag: '"updated-etag"', sync_status: 'synced' },
        error: null,
      })
      const mockSelectFn = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEqFn = vi.fn().mockReturnValue({ select: mockSelectFn })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })

      mockSupabaseFrom.mockReturnValue({ update: mockUpdateFn })

      const result = await pushEvent(event, calendar)

      // Verify If-Match header was sent
      const [url, opts] = (globalThis.fetch as any).mock.calls[0]
      expect(opts.headers['If-Match']).toBe('"old-etag"')
      expect(result.etag).toBe('"updated-etag"')
    })

    it('resolves ETag conflict with re-fetch and merge on 412', async () => {
      const event = makeEvent({
        google_event_id: 'conflict-evt',
        etag: '"stale-etag"',
        title: 'My version',
      })
      const calendar = makeCalendar()

      // First call: 412 Precondition Failed
      ;(globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 412,
        text: async () => 'Precondition Failed',
      })

      mockGetGoogleAccessToken.mockResolvedValue('test-token')

      // Re-fetch latest from Google (resolveConflict calls googleCalendarRequest)
      mockGoogleCalendarRequest.mockResolvedValueOnce({
        id: 'conflict-evt',
        summary: 'Google version',
        start: { dateTime: '2026-06-15T09:00:00Z' },
        end: { dateTime: '2026-06-15T10:00:00Z' },
        etag: '"google-etag"',
        kind: 'calendar#event',
        htmlLink: 'https://calendar.google.com',
        created: '2026-01-01',
        updated: '2026-06-14',
      })

      // Force-write merged result (updateGoogleEvent)
      mockUpdateGoogleEvent.mockResolvedValue({
        id: 'conflict-evt',
        etag: '"merged-etag"',
      })

      const mockSingle = vi.fn().mockResolvedValue({
        data: { ...event, etag: '"merged-etag"', sync_status: 'synced' },
        error: null,
      })
      const mockSelectFn = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEqFn = vi.fn().mockReturnValue({ select: mockSelectFn })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })

      mockSupabaseFrom.mockReturnValue({ update: mockUpdateFn })

      const result = await pushEvent(event, calendar)

      // Verify conflict resolution occurred
      expect(mockGoogleCalendarRequest).toHaveBeenCalled()
      expect(mockUpdateGoogleEvent).toHaveBeenCalledWith(
        'acct-1',
        'primary',
        'conflict-evt',
        expect.objectContaining({ summary: 'My version' }) // local takes precedence
      )
      // Read-only fields should be stripped from the merged payload
      const mergedPayload = mockUpdateGoogleEvent.mock.calls[0]![3]
      expect(mergedPayload.kind).toBeUndefined()
      expect(mergedPayload.htmlLink).toBeUndefined()
      expect(mergedPayload.created).toBeUndefined()

      expect(result.etag).toBe('"merged-etag"')
    })

    it('captures conferencing URL from Google response', async () => {
      const event = makeEvent({ google_event_id: null, conferencing_url: null })
      const calendar = makeCalendar()

      mockCreateGoogleEvent.mockResolvedValue({
        id: 'g-evt-meet',
        etag: '"e"',
        conferenceData: {
          entryPoints: [
            { entryPointType: 'video', uri: 'https://meet.google.com/xyz' },
          ],
        },
      })

      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          ...event,
          google_event_id: 'g-evt-meet',
          conferencing_url: 'https://meet.google.com/xyz',
          sync_status: 'synced',
        },
        error: null,
      })
      const mockSelectFn = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEqFn = vi.fn().mockReturnValue({ select: mockSelectFn })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockEqFn })

      mockSupabaseFrom.mockReturnValue({ update: mockUpdateFn })

      const result = await pushEvent(event, calendar)

      // Verify the conferencing URL was stored
      const updateCall = mockUpdateFn.mock.calls[0]![0]
      expect(updateCall.conferencing_url).toBe('https://meet.google.com/xyz')
    })
  })

  // ── deleteRemoteEvent ─────────────────────────────────────────────────

  describe('deleteRemoteEvent()', () => {
    it('calls deleteGoogleEvent when event has google_event_id', async () => {
      const event = makeEvent({ google_event_id: 'g-evt-del' })
      const calendar = makeCalendar()

      mockDeleteGoogleEvent.mockResolvedValue(undefined)

      await deleteRemoteEvent(event, calendar)

      expect(mockDeleteGoogleEvent).toHaveBeenCalledWith(
        'acct-1',
        'primary',
        'g-evt-del'
      )
    })

    it('does nothing when event has no google_event_id', async () => {
      const event = makeEvent({ google_event_id: null })
      const calendar = makeCalendar()

      await deleteRemoteEvent(event, calendar)

      expect(mockDeleteGoogleEvent).not.toHaveBeenCalled()
    })
  })

  // ── pullChanges ───────────────────────────────────────────────────────

  describe('pullChanges()', () => {
    it('upserts new events from Google', async () => {
      // Mock account lookup
      const mockAccountSingle = vi.fn().mockResolvedValue({
        data: { sync_token: null, user_id: 'user-1' },
        error: null,
      })
      const mockAccountEq = vi.fn().mockReturnValue({ single: mockAccountSingle })
      const mockAccountSelect = vi.fn().mockReturnValue({ eq: mockAccountEq })

      // Mock calendars lookup
      const mockCalEq2 = vi.fn().mockResolvedValue({
        data: [{ id: 'cal-1', google_calendar_id: 'primary' }],
        error: null,
      })
      const mockCalEq1 = vi.fn().mockReturnValue({ eq: mockCalEq2 })
      const mockCalSelect = vi.fn().mockReturnValue({ eq: mockCalEq1 })

      // Mock event existence check (not found → insert)
      const mockEvtSingle = vi.fn().mockResolvedValue({ data: null, error: null })
      const mockEvtEqGid = vi.fn().mockReturnValue({ single: mockEvtSingle })
      const mockEvtEqCal = vi.fn().mockReturnValue({ eq: mockEvtEqGid })
      const mockEvtSelect = vi.fn().mockReturnValue({ eq: mockEvtEqCal })

      // Mock event insert
      const mockEvtInsert = vi.fn().mockResolvedValue({ error: null })

      // Mock sync token update
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      let fromCallCount = 0
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'google_accounts') {
          fromCallCount++
          if (fromCallCount <= 1) return { select: mockAccountSelect }
          return { update: mockUpdateFn }
        }
        if (table === 'calendars') {
          return { select: mockCalSelect }
        }
        if (table === 'events') {
          return { select: mockEvtSelect, insert: mockEvtInsert }
        }
        return {}
      })

      // Mock Google API response
      mockListGoogleEvents.mockResolvedValue({
        items: [
          {
            id: 'g-new-1',
            summary: 'New event',
            start: { dateTime: '2026-06-15T09:00:00Z' },
            end: { dateTime: '2026-06-15T10:00:00Z' },
            status: 'confirmed',
            etag: '"e1"',
          },
        ],
        nextSyncToken: 'new-sync-token',
      })

      const result = await pullChanges('acct-1')

      expect(result.created).toBe(1)
      expect(mockEvtInsert).toHaveBeenCalled()
    })

    it('deletes locally when Google event status is cancelled (incremental)', async () => {
      // Account has existing sync token (incremental sync)
      const mockAccountSingle = vi.fn().mockResolvedValue({
        data: { sync_token: 'existing-token', user_id: 'user-1' },
        error: null,
      })
      const mockAccountEq = vi.fn().mockReturnValue({ single: mockAccountSingle })
      const mockAccountSelect = vi.fn().mockReturnValue({ eq: mockAccountEq })

      const mockCalEq2 = vi.fn().mockResolvedValue({
        data: [{ id: 'cal-1', google_calendar_id: 'primary' }],
        error: null,
      })
      const mockCalEq1 = vi.fn().mockReturnValue({ eq: mockCalEq2 })
      const mockCalSelect = vi.fn().mockReturnValue({ eq: mockCalEq1 })

      // Event exists locally
      const mockEvtSingle = vi.fn().mockResolvedValue({
        data: { id: 'local-evt-1', etag: '"old"' },
        error: null,
      })
      const mockEvtEqGid = vi.fn().mockReturnValue({ single: mockEvtSingle })
      const mockEvtEqCal = vi.fn().mockReturnValue({ eq: mockEvtEqGid })
      const mockEvtSelect = vi.fn().mockReturnValue({ eq: mockEvtEqCal })

      // Delete mock
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
      const mockEvtDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq })

      // Sync token update
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdateFn = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      let fromCallCount = 0
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'google_accounts') {
          fromCallCount++
          if (fromCallCount <= 1) return { select: mockAccountSelect }
          return { update: mockUpdateFn }
        }
        if (table === 'calendars') {
          return { select: mockCalSelect }
        }
        if (table === 'events') {
          return { select: mockEvtSelect, delete: mockEvtDelete }
        }
        return {}
      })

      mockListGoogleEvents.mockResolvedValue({
        items: [
          {
            id: 'g-deleted',
            status: 'cancelled',
          },
        ],
        nextSyncToken: 'newer-token',
      })

      const result = await pullChanges('acct-1')

      expect(result.deleted).toBe(1)
      expect(mockEvtDelete).toHaveBeenCalled()
    })
  })

  // ── handleWebhook ─────────────────────────────────────────────────────

  describe('handleWebhook()', () => {
    it('triggers pullChanges for active accounts', async () => {
      // Mock calendars lookup to find active accounts
      const mockCalEq = vi.fn().mockResolvedValue({
        data: [{ google_account_id: 'acct-1' }],
        error: null,
      })
      const mockCalSelect = vi.fn().mockReturnValue({ eq: mockCalEq })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'calendars') {
          return { select: mockCalSelect }
        }
        // pullChanges will also call from() for google_accounts, calendars, events
        // Since we're testing handleWebhook dispatching, we can let pullChanges throw
        // and verify the error is caught gracefully
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'mock error for pull' },
              }),
            }),
          }),
        }
      })

      // handleWebhook catches errors from pullChanges, so this should not throw
      await expect(
        handleWebhook('channel-uuid', 'resource-id')
      ).resolves.toBeUndefined()
    })

    it('does nothing when no active calendars exist', async () => {
      const mockCalEq = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })
      const mockCalSelect = vi.fn().mockReturnValue({ eq: mockCalEq })

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'calendars') {
          return { select: mockCalSelect }
        }
        return {}
      })

      await expect(
        handleWebhook('channel-uuid', 'resource-id')
      ).resolves.toBeUndefined()
    })
  })
})
