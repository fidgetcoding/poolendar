import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../lib/auth/helpers'
import { autoScheduleRunSchema } from '@poolendar/validators'
import { runSchedulingPipeline, PipelineError } from '../../../../lib/auto-schedule/pipeline'

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (isAuthError(auth)) return auth
    const { userId, supabase } = auth

    let rawBody: unknown = {}
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = autoScheduleRunSchema.safeParse(rawBody)
    if (!parsed.success) {
      return validationError(parsed.error.issues)
    }

    const { confirm, window_days: windowDays } = parsed.data

    const result = await runSchedulingPipeline(supabase, userId, windowDays)

    if (result.message) {
      return NextResponse.json({ placements: result.placements, message: result.message })
    }

    if (!confirm) {
      return NextResponse.json({ placements: result.placements, applied: false })
    }

    // Batch apply placements with Promise.all instead of sequential N+1
    const updateResults = await Promise.all(
      result.placements.map((placement) =>
        supabase
          .from('tasks')
          .update({
            scheduled_start: placement.scheduled_start,
            scheduled_end: placement.scheduled_end,
            frame_id: placement.frame_id,
            auto_scheduled: true,
          })
          .eq('id', placement.task_id)
          .eq('user_id', userId)
      ),
    )

    const appliedCount = updateResults.filter((r) => !r.error).length
    const failedIds = updateResults
      .map((r, i) => (r.error ? result.placements[i]?.task_id : null))
      .filter(Boolean)

    // Record last run timestamp in profile settings
    await supabase
      .from('profiles')
      .update({
        settings: {
          ...(result.settings as Record<string, unknown>),
          auto_schedule_last_run_at: new Date().toISOString(),
        },
      })
      .eq('id', userId)

    return NextResponse.json({
      placements: result.placements,
      applied: true,
      applied_count: appliedCount,
      ...(failedIds.length > 0 && { failed_task_ids: failedIds }),
    })
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('Auto-schedule run failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
