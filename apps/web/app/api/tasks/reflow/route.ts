import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../lib/auth/helpers'
import { reflowSchema } from '@poolendar/validators'

// Fallback timezone matches the app-wide default used for events/routines.
const DEFAULT_TZ = 'America/New_York'

/** The calendar date (YYYY-MM-DD) that an instant lands on, in `tz`. */
function tzDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/**
 * POST /api/tasks/reflow (spec #75) — repack a day's flexible scheduled tasks
 * so they no longer overlap. Tasks keep their original order (by scheduled
 * start) and their durations; each is placed immediately after the previous
 * one, starting from the day's first flexible task. Events are never touched
 * (only tasks are considered) and non-flexible tasks are left where they are.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = reflowSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { date } = parsed.data
  const timezone = parsed.data.timezone ?? DEFAULT_TZ

  // Pull scheduled tasks near the day (±14h covers every timezone offset), then
  // keep only those whose scheduled_start lands on `date` in `timezone`.
  const { data: nearby, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .not('scheduled_start', 'is', null)
    .not('scheduled_end', 'is', null)
    // ±14h of offset makes the window a superset of "this date in ANY timezone":
    // midnight-on-date at the easternmost offset (+14) is the earliest instant,
    // end-of-date at the westernmost (-14) is the latest.
    .gte('scheduled_start', `${date}T00:00:00+14:00`)
    .lte('scheduled_start', `${date}T23:59:59-14:00`)

  if (error) {
    return NextResponse.json({ error: 'Failed to load day tasks' }, { status: 500 })
  }

  const dayTasks = (nearby ?? []).filter(
    (t) => tzDate(t.scheduled_start as string, timezone) === date
  )

  // Flexible, unsplit tasks are the ones we may move, in original start order.
  const flexible = dayTasks
    .filter((t) => t.flexibility === 'flexible' && !t.is_split)
    .sort(
      (a, b) =>
        new Date(a.scheduled_start as string).getTime() -
        new Date(b.scheduled_start as string).getTime()
    )

  const newTimes = new Map<string, { scheduled_start: string; scheduled_end: string }>()
  let moved = 0

  if (flexible.length > 0) {
    let cursor = new Date(flexible[0]!.scheduled_start as string).getTime()
    for (const t of flexible) {
      const origStart = new Date(t.scheduled_start as string).getTime()
      const duration = new Date(t.scheduled_end as string).getTime() - origStart
      const newStart = new Date(cursor).toISOString()
      const newEnd = new Date(cursor + duration).toISOString()
      cursor += duration

      if (cursor - duration !== origStart) {
        newTimes.set(t.id as string, { scheduled_start: newStart, scheduled_end: newEnd })
        moved++
        const { error: upErr } = await supabase
          .from('tasks')
          .update({ scheduled_start: newStart, scheduled_end: newEnd })
          .eq('id', t.id)
          .eq('user_id', userId)
        if (upErr) {
          return NextResponse.json({ error: 'Failed to reschedule a task' }, { status: 500 })
        }
      }
    }
  }

  const tasks = dayTasks
    .map((t) => {
      const nt = newTimes.get(t.id as string)
      return nt ? { ...t, ...nt } : t
    })
    .sort(
      (a, b) =>
        new Date(a.scheduled_start as string).getTime() -
        new Date(b.scheduled_start as string).getTime()
    )

  return NextResponse.json({ date, timezone, moved, tasks })
}
