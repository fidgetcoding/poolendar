import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../supabase/server'
import { authenticateApiKey } from './api-key'

export interface AuthResult {
  userId: string
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function authenticate(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  // Try API key auth first
  const apiKeyUserId = await authenticateApiKey(request)
  if (apiKeyUserId) {
    const supabase = await createClient()
    // Set the user context for RLS by impersonating the user
    // Use service role client for API key auth since there's no session
    const { createServerClient } = await import('@supabase/ssr')
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      }
    )
    return { userId: apiKeyUserId, supabase: serviceClient as any }
  }

  // Fall back to session auth
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return { userId: user.id, supabase }
}

export function isAuthError(result: AuthResult | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}

export function validationError(issues: { path: (string | number)[]; message: string }[]) {
  const details: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || '_root'
    if (!details[key]) details[key] = []
    details[key].push(issue.message)
  }
  return NextResponse.json(
    { error: 'Validation error', details },
    { status: 400 }
  )
}
