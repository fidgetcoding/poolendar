import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'
import { runSchedulingPipeline, PipelineError } from '../../../../lib/auto-schedule/pipeline'

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (isAuthError(auth)) return auth
    const { userId, supabase } = auth

    let windowDays = 7
    try {
      const body = await request.json()
      if (typeof body.window_days === 'number') {
        windowDays = Math.min(30, Math.max(1, body.window_days))
      }
    } catch { /* use default */ }

    const result = await runSchedulingPipeline(supabase, userId, windowDays)

    if (result.message) {
      return NextResponse.json({ placements: result.placements, message: result.message })
    }

    return NextResponse.json({ placements: result.placements })
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error('Auto-schedule preview failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
