import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { runSchedulingPipeline } from '@/lib/auto-schedule/pipeline'
import { verifyCronSecret } from '@/lib/auth/cron'

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )
}

/** Minimum interval between auto-schedule runs per user (5 hours). */
const MIN_INTERVAL_MS = 5 * 60 * 60_000

/** Default scheduling window in days. */
const WINDOW_DAYS = 7

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getServiceClient()
    let processed = 0
    const errors: string[] = []

    // Find all profiles where auto-scheduling is enabled.
    // The setting is stored in profiles.settings as a JSON object.
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, settings')

    if (profilesError) {
      return NextResponse.json(
        { error: `Failed to fetch profiles: ${profilesError.message}` },
        { status: 500 }
      )
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ success: true, processed: 0 })
    }

    const now = new Date()

    for (const profile of profiles) {
      try {
        const settings = (profile.settings as Record<string, unknown>) ?? {}

        // Check if auto-scheduling is enabled for this user
        if (!settings.auto_schedule_enabled) {
          continue
        }

        // Check if the last run was within the minimum interval
        const lastRun = settings.auto_schedule_last_cron_run as string | undefined
        if (lastRun) {
          const lastRunDate = new Date(lastRun)
          if (now.getTime() - lastRunDate.getTime() < MIN_INTERVAL_MS) {
            continue // Skip -- ran too recently
          }
        }

        // Run the scheduling pipeline
        const result = await runSchedulingPipeline(
          supabase,
          profile.id,
          WINDOW_DAYS
        )

        // Apply placements: update each task with its scheduled times
        if (result.placements.length > 0) {
          for (const placement of result.placements) {
            await supabase
              .from('tasks')
              .update({
                scheduled_start: placement.scheduled_start,
                scheduled_end: placement.scheduled_end,
                frame_id: placement.frame_id,
                auto_scheduled: true,
                updated_at: now.toISOString(),
              })
              .eq('id', placement.task_id)
              .eq('user_id', profile.id)
          }
        }

        // Record the last run timestamp in profile settings
        await supabase
          .from('profiles')
          .update({
            settings: {
              ...settings,
              auto_schedule_last_cron_run: now.toISOString(),
            },
            updated_at: now.toISOString(),
          })
          .eq('id', profile.id)

        console.log(
          `Auto-schedule: user=${profile.id} placements=${result.placements.length}`
        )
        processed++
      } catch (err) {
        const msg = `User ${profile.id}: ${err instanceof Error ? err.message : 'unknown error'}`
        errors.push(msg)
        console.error('Auto-schedule failed:', msg)
        // Continue processing other users
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    console.error('Cron auto-schedule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
