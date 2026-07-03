import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../../lib/auth/helpers'
import { paginate } from '../../../../../lib/pagination'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  // Verify the booking link belongs to this user
  const { data: link, error: linkError } = await supabase
    .from('booking_links')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (linkError || !link) {
    return NextResponse.json(
      { error: 'Booking link not found' },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_link_id, booker_name, booker_email, booker_notes, start_time, end_time, status, google_event_id, created_at, updated_at')
    .eq('booking_link_id', id)
    .order('start_time', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    )
  }

  return NextResponse.json(paginate(data ?? [], request.nextUrl.searchParams))
}
