import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (isAuthError(auth)) return auth
    const { userId, supabase } = auth

    const [profileResult, scheduledResult, unscheduledResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('settings')
        .eq('id', userId)
        .single(),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('auto_scheduled', true),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('scheduled_start', null)
        .not('status', 'eq', 'done')
        .eq('is_split', false),
    ])

    const settings = (profileResult.data?.settings as Record<string, any>) ?? {}

    return NextResponse.json({
      enabled: settings.auto_schedule_ai_enabled ?? false,
      last_run_at: settings.auto_schedule_last_run_at ?? null,
      scheduled_count: scheduledResult.count ?? 0,
      unscheduled_count: unscheduledResult.count ?? 0,
    })
  } catch (error) {
    console.error('Auto-schedule status failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
