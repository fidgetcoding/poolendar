import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (isAuthError(auth)) return auth
    const { userId, supabase } = auth

    const { data, error } = await supabase
      .from('tasks')
      .update({
        scheduled_start: null,
        scheduled_end: null,
        frame_id: null,
        auto_scheduled: false,
      })
      .eq('user_id', userId)
      .eq('auto_scheduled', true)
      .select('id')

    if (error) {
      return NextResponse.json({ error: 'Failed to unschedule tasks' }, { status: 500 })
    }

    return NextResponse.json({ unscheduled_count: data?.length ?? 0 })
  } catch (error) {
    console.error('Auto-schedule unschedule failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
