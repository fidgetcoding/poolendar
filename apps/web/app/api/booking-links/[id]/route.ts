import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../lib/auth/helpers'
import { updateBookingLinkSchema } from '@poolendar/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('booking_links')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Booking link not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = updateBookingLinkSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const input = parsed.data

  // Verify ownership
  const { data: existing, error: fetchError } = await supabase
    .from('booking_links')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json(
      { error: 'Booking link not found' },
      { status: 404 }
    )
  }

  // If updating google_account_id, verify it belongs to this user
  if (input.google_account_id) {
    const { data: account, error: accountError } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('id', input.google_account_id)
      .eq('user_id', userId)
      .single()

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Google account not found or access denied' },
        { status: 404 }
      )
    }
  }

  const { data, error } = await supabase
    .from('booking_links')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A booking link with this slug already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update booking link' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { error } = await supabase
    .from('booking_links')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete booking link' },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
