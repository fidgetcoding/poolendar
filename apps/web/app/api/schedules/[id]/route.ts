import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../../lib/auth/helpers'
import { z } from 'zod'

const timeBlockSchema = z.object({
  day: z.number().int().min(0).max(6),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
})

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  time_blocks: z.array(timeBlockSchema),
}).partial()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Schedule not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: parsed.error.issues.reduce(
          (acc, issue) => {
            const key = issue.path.join('.') || '_root'
            if (!acc[key]) acc[key] = []
            acc[key].push(issue.message)
            return acc
          },
          {} as Record<string, string[]>
        ),
      },
      { status: 400 }
    )
  }

  const input = parsed.data

  const { data, error } = await supabase
    .from('schedules')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Schedule not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { id } = await params

  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
