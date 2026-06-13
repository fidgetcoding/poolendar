import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth

  let body: { order?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json(
      { error: 'order must be a non-empty array of frame IDs' },
      { status: 400 }
    )
  }

  // Verify all IDs belong to the user
  const { data: existing, error: fetchError } = await supabase
    .from('frames')
    .select('id')
    .eq('user_id', userId)

  if (fetchError) {
    return NextResponse.json(
      { error: 'Failed to fetch frames' },
      { status: 500 }
    )
  }

  const existingIds = new Set((existing ?? []).map((f: { id: string }) => f.id))
  for (const id of body.order) {
    if (!existingIds.has(id)) {
      return NextResponse.json(
        { error: `Frame ${id} not found` },
        { status: 404 }
      )
    }
  }

  // Update priority_rank for each frame
  const updates = body.order.map((id, index) =>
    supabase
      .from('frames')
      .update({ priority_rank: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
  )

  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return NextResponse.json(
      { error: 'Failed to reorder frames' },
      { status: 500 }
    )
  }

  // Return updated frames in new order
  const { data: reordered } = await supabase
    .from('frames')
    .select('*')
    .eq('user_id', userId)
    .order('priority_rank', { ascending: true })

  return NextResponse.json(reordered ?? [])
}
