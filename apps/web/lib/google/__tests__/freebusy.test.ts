import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getGoogleAccessToken = vi.fn()
vi.mock('../calendar', () => ({
  getGoogleAccessToken: (...args: unknown[]) => getGoogleAccessToken(...args),
}))

import { getGoogleBusyPeriods, __resetFreeBusyWarn } from '../freebusy'

const timeMin = new Date('2026-08-03T00:00:00Z')
const timeMax = new Date('2026-08-04T00:00:00Z')

beforeEach(() => {
  getGoogleAccessToken.mockReset()
  __resetFreeBusyWarn()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getGoogleBusyPeriods — connected-account guard', () => {
  it('returns [] and never calls Google when no account is connected', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const out = await getGoogleBusyPeriods({ googleAccountId: null, timeMin, timeMax })
    expect(out).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(getGoogleAccessToken).not.toHaveBeenCalled()
  })
})

describe('getGoogleBusyPeriods — happy path (mocked)', () => {
  it('flattens busy periods across returned calendars', async () => {
    getGoogleAccessToken.mockResolvedValue('token-abc')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          calendars: {
            primary: { busy: [{ start: '2026-08-03T14:00:00Z', end: '2026-08-03T15:00:00Z' }] },
            other: { busy: [{ start: '2026-08-03T16:00:00Z', end: '2026-08-03T16:30:00Z' }] },
          },
        }),
      })
    )

    const out = await getGoogleBusyPeriods({
      googleAccountId: 'acct-1',
      timeMin,
      timeMax,
    })

    expect(out).toEqual([
      { start: '2026-08-03T14:00:00Z', end: '2026-08-03T15:00:00Z' },
      { start: '2026-08-03T16:00:00Z', end: '2026-08-03T16:30:00Z' },
    ])
  })

  it('sends timeMin/timeMax and primary as default calendar', async () => {
    getGoogleAccessToken.mockResolvedValue('token-abc')
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ calendars: {} }) })
    vi.stubGlobal('fetch', fetchSpy)

    await getGoogleBusyPeriods({ googleAccountId: 'acct-1', timeMin, timeMax })

    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body)
    expect(body.timeMin).toBe(timeMin.toISOString())
    expect(body.timeMax).toBe(timeMax.toISOString())
    expect(body.items).toEqual([{ id: 'primary' }])
  })
})

describe('getGoogleBusyPeriods — graceful degradation', () => {
  it('returns [] when the token lookup throws (e.g. account gone / bad tokens)', async () => {
    getGoogleAccessToken.mockRejectedValue(new Error('Google account not found'))
    const out = await getGoogleBusyPeriods({ googleAccountId: 'acct-x', timeMin, timeMax })
    expect(out).toEqual([])
  })

  it('returns [] on a non-OK Google response', async () => {
    getGoogleAccessToken.mockResolvedValue('token-abc')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'forbidden' })
    )
    const out = await getGoogleBusyPeriods({ googleAccountId: 'acct-1', timeMin, timeMax })
    expect(out).toEqual([])
  })

  it('warns only once across repeated failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getGoogleAccessToken.mockRejectedValue(new Error('boom'))
    await getGoogleBusyPeriods({ googleAccountId: 'a', timeMin, timeMax })
    await getGoogleBusyPeriods({ googleAccountId: 'a', timeMin, timeMax })
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
