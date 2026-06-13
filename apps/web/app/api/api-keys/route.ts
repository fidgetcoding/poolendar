import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../lib/auth/helpers'
import { z } from 'zod'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(200),
})

function generateApiKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pk_${hex}`
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  }

  return NextResponse.json(keys)
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createApiKeySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const rawKey = generateApiKey()
  const keyHash = await hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 8)

  const { data: apiKey, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name: parsed.data.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select('id, name, key_prefix, last_used_at, created_at')
    .single()

  if (error || !apiKey) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }

  return NextResponse.json(
    { ...apiKey, key: rawKey },
    { status: 201 }
  )
}
