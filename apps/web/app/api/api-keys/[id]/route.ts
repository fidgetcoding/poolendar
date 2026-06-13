import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
