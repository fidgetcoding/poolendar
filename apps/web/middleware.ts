import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  const subdomain = hostname.split('.')[0]

  // Subdomain routing for booking pages
  // If subdomain is not the app itself, treat it as a booking page namespace
  const isBookingSubdomain =
    subdomain !== 'app' &&
    subdomain !== 'www' &&
    subdomain !== 'poolendar' &&
    subdomain !== 'localhost' &&
    !subdomain.startsWith('localhost:') &&
    hostname.includes('.')

  if (isBookingSubdomain) {
    const url = request.nextUrl.clone()
    const bookingPath = url.pathname === '/' ? '' : url.pathname
    url.pathname = `/(booking)${bookingPath}`
    const response = NextResponse.rewrite(url)
    response.headers.set('x-booking-username', subdomain)
    return response
  }

  const { supabase, response } = createClient(request)

  // Refresh session on every request
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes: auth pages, booking pages, API routes, static assets
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/callback') ||
    pathname.startsWith('/(booking)') ||
    pathname.startsWith('/api/booking/availability') ||
    pathname.startsWith('/api/booking/book') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')

  // API routes get their own auth handling via the authenticate() helper
  const isApiRoute = pathname.startsWith('/api/')

  if (isPublicRoute || isApiRoute) {
    return response
  }

  // Protected routes: redirect to login if no session
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user visiting /login — redirect to app
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
