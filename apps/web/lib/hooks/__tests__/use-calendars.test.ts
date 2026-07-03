import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createTestQueryClient } from './test-utils'
import {
  useCalendars,
  flattenCalendars,
  calendarKeys,
  type CalendarAccountGroup,
} from '../use-calendars'
import type { Calendar } from '@poolendar/types'

const now = '2026-07-03T12:00:00.000Z'

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: 'cal-1',
    user_id: 'user-1',
    google_account_id: 'acct-1',
    google_calendar_id: 'primary',
    name: 'Primary',
    color: '#3b82f6',
    is_primary: true,
    is_active: true,
    access_role: 'owner',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeAccount(
  id: string,
  calendars: Calendar[]
): CalendarAccountGroup {
  return {
    id,
    email: `${id}@example.com`,
    token_expires_at: now,
    sync_token: null,
    last_synced_at: null,
    created_at: now,
    calendars,
  }
}

describe('flattenCalendars', () => {
  it('flattens sub-calendars across accounts in order', () => {
    const accounts = [
      makeAccount('acct-1', [makeCalendar({ id: 'c1' })]),
      makeAccount('acct-2', [
        makeCalendar({ id: 'c2', google_account_id: 'acct-2' }),
        makeCalendar({ id: 'c3', google_account_id: 'acct-2', is_primary: false }),
      ]),
    ]
    const flat = flattenCalendars(accounts)
    expect(flat.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
  })

  it('handles missing / empty inputs', () => {
    expect(flattenCalendars(undefined)).toEqual([])
    expect(flattenCalendars([])).toEqual([])
    expect(
      flattenCalendars([makeAccount('a', [] as Calendar[])])
    ).toEqual([])
  })
})

describe('useCalendars', () => {
  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockReset()
  })

  it('fetches /api/calendars and returns a flat calendar list', async () => {
    const accounts = [
      makeAccount('acct-1', [makeCalendar({ id: 'c1' })]),
      makeAccount('acct-2', [makeCalendar({ id: 'c2', google_account_id: 'acct-2' })]),
    ]
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accounts }),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useCalendars(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/calendars')
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data!.map((c) => c.id)).toEqual(['c1', 'c2'])

    queryClient.clear()
  })

  it('throws on a non-ok response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const { queryClient, wrapper } = createTestQueryClient()
    const { result } = renderHook(() => useCalendars(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    queryClient.clear()
  })
})

describe('calendarKeys', () => {
  it('builds a stable key hierarchy', () => {
    expect(calendarKeys.all).toEqual(['calendars'])
    expect(calendarKeys.list()).toEqual(['calendars', 'list'])
  })
})
