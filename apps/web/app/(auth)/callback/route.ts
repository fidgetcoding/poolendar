import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingProfile) {
          const username =
            user.user_metadata?.name
              ?.toLowerCase()
              .replace(/[^a-z0-9]/g, '')
              .slice(0, 20) ||
            user.email?.split('@')[0]?.replace(/[^a-z0-9]/g, '') ||
            user.id.slice(0, 8)

          await supabase.from('profiles').insert({
            id: user.id,
            username,
            display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
          })
        }

        const providerToken = sessionData?.session?.provider_token
        const providerRefreshToken = sessionData?.session?.provider_refresh_token

        let googleAccountLinked = false

        if (providerToken && user.app_metadata?.provider === 'google') {
          const tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
          const { data: googleAccount, error: gaError } = await supabase.from('google_accounts').upsert(
            {
              user_id: user.id,
              email: user.email!,
              access_token: providerToken,
              refresh_token: providerRefreshToken || '',
              token_expires_at: tokenExpiresAt,
            },
            { onConflict: 'user_id,email' }
          ).select().single()

          if (gaError) {
            console.error('[callback] google_accounts upsert failed:', gaError.message)
          }

          if (googleAccount) {
            googleAccountLinked = true
            try {
              const calRes = await fetch(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList',
                { headers: { Authorization: `Bearer ${providerToken}` } }
              )
              if (calRes.ok) {
                const calList = await calRes.json()
                for (const cal of calList.items ?? []) {
                  await supabase.from('calendars').upsert(
                    {
                      user_id: user.id,
                      google_account_id: googleAccount.id,
                      google_calendar_id: cal.id,
                      name: cal.summary || cal.id,
                      color: cal.backgroundColor || '#4285f4',
                      is_primary: cal.primary || false,
                      is_active: true,
                      access_role: cal.accessRole || null,
                    },
                    { onConflict: 'google_account_id,google_calendar_id' }
                  )
                }
              } else {
                console.error('[callback] Google Calendar API error:', calRes.status, await calRes.text().catch(() => ''))
              }
            } catch (err) {
              console.error('[callback] Calendar list fetch error:', err)
            }
          }
        } else {
          console.log('[callback] No provider_token from Supabase session — will redirect to Google Connect')
        }

        if (!googleAccountLinked) {
          const { count } = await supabase
            .from('google_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)

          if (!count || count === 0) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://poolendar.com'
            return NextResponse.redirect(`${appUrl}/api/google/connect`)
          }
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
