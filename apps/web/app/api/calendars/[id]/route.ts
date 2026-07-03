import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, isAuthError, validationError } from '@/lib/auth/helpers'
import { disconnectGoogleAccount } from '@/lib/google/oauth'
import { updateGoogleCalendarColor } from '@/lib/google/calendar'

const patchSchema = z
  .object({
    is_active: z.boolean().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex string')
      .optional(),
  })
  .refine((v) => v.is_active !== undefined || v.color !== undefined, {
    message: 'Provide at least one of is_active or color',
  })

/**
 * PATCH /api/calendars/:id — toggle is_active and/or change colour. A colour
 * change is also pushed to Google (calendarList.update); a Google failure is
 * stored locally and silently swallowed (spec #49a).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { data: calendar, error: calError } = await supabase
    .from('calendars')
    .select('id, google_account_id, google_calendar_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (calError || !calendar) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  const updates: { is_active?: boolean; color?: string } = {}
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active
  if (parsed.data.color !== undefined) {
    updates.color = parsed.data.color
    try {
      await updateGoogleCalendarColor(
        calendar.google_account_id,
        calendar.google_calendar_id,
        parsed.data.color
      )
    } catch (err) {
      // Local colour is authoritative for rendering — swallow the Google error.
      console.error('[calendars/PATCH] Google colour push failed (stored locally):', err)
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('calendars')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json(
      { error: 'Failed to update calendar' },
      { status: 500 }
    )
  }

  return NextResponse.json(updated)
}

/**
 * DELETE /api/calendars/:id — disconnects the google_account that OWNS this
 * calendar (spec semantics: disconnect account), which cascades to all its
 * calendars + events. Ownership verified under RLS first.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data: calendar, error: calError } = await supabase
    .from('calendars')
    .select('google_account_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (calError || !calendar) {
    return NextResponse.json({ error: 'Calendar not found' }, { status: 404 })
  }

  try {
    await disconnectGoogleAccount(calendar.google_account_id)
  } catch (err) {
    console.error('[calendars/DELETE] teardown failed:', err)
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
