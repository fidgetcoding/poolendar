import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'

export async function authenticateApiKey(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer pk_')) {
    return null
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() {},
      },
    }
  )

  const prefix = apiKey.slice(0, 8)
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_prefix', prefix)

  if (!keys || keys.length === 0) {
    return null
  }

  for (const key of keys) {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(apiKey)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (hashHex === key.key_hash) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', key.id)

      return key.user_id
    }
  }

  return null
}
