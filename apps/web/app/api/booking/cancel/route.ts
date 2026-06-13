// SERVICE ROLE: Required — public endpoint (no auth). External visitors cancel
// bookings using a secret cancel_token without logging in.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { rateLimitAsync } from '@/lib/rate-limit'

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll() { return [] }, setAll() {} } }
  )
}

export async function GET(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!(await rateLimitAsync(`cancel:${clientIp}`, 10, 60000))) {
    return new NextResponse(cancelPage('Too many requests. Please try again later.', true), {
      status: 429,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token || token.length < 10) {
    return new NextResponse(cancelPage('Invalid cancellation link.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = getServiceClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, status, booking_link_id, start_time, end_time, google_event_id, booking_links!inner(name, user_id, google_account_id)')
    .eq('cancel_token', token)
    .single()

  if (error || !booking) {
    return new NextResponse(cancelPage('Booking not found or already cancelled.', true), {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (booking.status === 'cancelled') {
    return new NextResponse(cancelPage('This booking has already been cancelled.', false), {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', booking.id)

  if (updateError) {
    return new NextResponse(cancelPage('Failed to cancel booking. Please try again.', true), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  if (booking.google_event_id) {
    try {
      const linkRaw = booking.booking_links as unknown as { user_id: string; google_account_id: string | null }[] | { user_id: string; google_account_id: string | null }
      const link = Array.isArray(linkRaw) ? linkRaw[0]! : linkRaw
      if (link.google_account_id) {
        const { getGoogleAccessToken, googleCalendarRequest } = await import('@/lib/google/calendar')
        const accessToken = await getGoogleAccessToken(link.google_account_id)

        const { data: calendar } = await supabase
          .from('calendars')
          .select('google_calendar_id')
          .eq('google_account_id', link.google_account_id)
          .eq('user_id', link.user_id)
          .limit(1)
          .single()

        if (calendar) {
          await googleCalendarRequest(
            accessToken,
            `/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events/${encodeURIComponent(booking.google_event_id)}`,
            { method: 'DELETE' }
          )
        }
      }
    } catch {
      // Google Calendar deletion failed — booking is still cancelled locally
    }
  }

  return new NextResponse(cancelPage('Your booking has been cancelled successfully.', false), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

function cancelPage(message: string, isError: boolean): string {
  const icon = isError ? '&#10060;' : '&#9989;'
  const color = isError ? '#ef4444' : '#22c55e'
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cancel Booking - Poolendar</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb;color:#1a1a1a">
<div style="text-align:center;max-width:400px;padding:24px">
<div style="font-size:48px;margin-bottom:16px">${icon}</div>
<p style="font-size:16px;color:${color};font-weight:600">${escapeHtml(message)}</p>
<p style="margin-top:24px;font-size:13px;color:#999">Poolendar</p>
</div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
