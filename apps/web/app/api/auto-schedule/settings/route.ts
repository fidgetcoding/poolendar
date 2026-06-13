import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'
import { z } from 'zod'

const patchSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  ai_classification: z.boolean().optional(),
  scoring_weights: z.object({
    urgency: z.number().min(0).max(1),
    deadline: z.number().min(0).max(1),
    tag_priority: z.number().min(0).max(1),
    staleness: z.number().min(0).max(1),
  }).optional(),
  paused_until: z.string().datetime().nullable().optional(),
}).strict()

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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = patchSettingsSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const body = parsed.data

  const { data: profile } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()

  const settings = { ...((profile?.settings as Record<string, any>) ?? {}) }

  // Map validated fields to the profile settings keys
  if (body.enabled !== undefined) {
    settings.auto_schedule_ai_enabled = body.enabled
  }
  if (body.ai_classification !== undefined) {
    settings.auto_schedule_ai_classification = body.ai_classification
  }
  if (body.scoring_weights !== undefined) {
    settings.auto_schedule_weights = body.scoring_weights
  }
  if (body.paused_until !== undefined) {
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
