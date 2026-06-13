import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth
  const { userId, supabase } = auth

  const { data: profile } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()

  const settings = (profile?.settings as Record<string, any>) ?? {}

  return NextResponse.json({
    enabled: settings.auto_schedule_ai_enabled ?? false,
    ai_classification: settings.auto_schedule_ai_classification ?? false,
    scoring_weights: settings.auto_schedule_weights ?? {
      urgency: 0.35,
      deadline: 0.30,
      tag_priority: 0.20,
      staleness: 0.15,
    },
    paused_until: settings.auto_schedule_paused_until ?? null,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth
  const { userId, supabase } = auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()

  const settings = { ...((profile?.settings as Record<string, any>) ?? {}) }

  // Map incoming fields to the profile settings keys
  if ('enabled' in body) {
    settings.auto_schedule_ai_enabled = body.enabled
  }
  if ('ai_classification' in body) {
    settings.auto_schedule_ai_classification = body.ai_classification
  }
  if ('scoring_weights' in body) {
    settings.auto_schedule_weights = body.scoring_weights
  }
  if ('paused_until' in body) {
    settings.auto_schedule_paused_until = body.paused_until
  }

  const { error } = await supabase
    .from('profiles')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    enabled: settings.auto_schedule_ai_enabled ?? false,
    ai_classification: settings.auto_schedule_ai_classification ?? false,
    scoring_weights: settings.auto_schedule_weights ?? {
      urgency: 0.35,
      deadline: 0.30,
      tag_priority: 0.20,
      staleness: 0.15,
    },
    paused_until: settings.auto_schedule_paused_until ?? null,
  })
}
