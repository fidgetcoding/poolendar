import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../../lib/auth/helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data: frame, error: readError } = await supabase
    .from('frames')
    .select('is_active')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (readError || !frame) {
    return NextResponse.json(
      { error: 'Frame not found' },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from('frames')
    .update({ is_active: !frame.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to toggle frame' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
