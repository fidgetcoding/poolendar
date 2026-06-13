import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError } from '../../../lib/auth/helpers'

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (isAuthError(auth)) return auth

  const { userId, supabase } = auth
  const { searchParams } = request.nextUrl

  const q = searchParams.get('q')
  if (!q || q.length === 0) {
    return NextResponse.json({ error: 'Missing required query parameter: q' }, { status: 400 })
  }

  const typesParam = searchParams.get('types')
  const types = typesParam ? typesParam.split(',') : ['event', 'task', 'routine', 'booking_link']
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const pattern = `%${q}%`

  const results: { type: string; id: string; title: string; date: string | null; snippet: string | null }[] = []

  const queries: Promise<void>[] = []

  if (types.includes('event')) {
    queries.push(
      supabase
        .from('events')
        .select('id, title, notes, start_time')
        .eq('user_id', userId)
        .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
        .order('start_time', { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          for (const e of data ?? []) {
            results.push({
              type: 'event',
              id: e.id,
              title: e.title,
              date: e.start_time,
              snippet: e.notes ? e.notes.slice(0, 200) : null,
            })
          }
        })
    )
  }

  if (types.includes('task')) {
    queries.push(
      supabase
        .from('tasks')
        .select('id, title, notes, due_date, created_at')
        .eq('user_id', userId)
        .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          for (const t of data ?? []) {
            results.push({
              type: 'task',
              id: t.id,
              title: t.title,
              date: t.due_date || t.created_at,
              snippet: t.notes ? t.notes.slice(0, 200) : null,
            })
          }
        })
    )
  }

  if (types.includes('routine')) {
    queries.push(
      supabase
        .from('routines')
        .select('id, title, notes, created_at')
        .eq('user_id', userId)
        .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          for (const r of data ?? []) {
            results.push({
              type: 'routine',
              id: r.id,
              title: r.title,
              date: r.created_at,
              snippet: r.notes ? r.notes.slice(0, 200) : null,
            })
          }
        })
    )
  }

  if (types.includes('booking_link')) {
    queries.push(
      supabase
        .from('booking_links')
        .select('id, name, notes, created_at')
        .eq('user_id', userId)
        .or(`name.ilike.${pattern},notes.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) => {
          for (const b of data ?? []) {
            results.push({
              type: 'booking_link',
              id: b.id,
              title: b.name,
              date: b.created_at,
              snippet: b.notes ? b.notes.slice(0, 200) : null,
            })
          }
        })
    )
  }

  await Promise.all(queries)

  // Sort by date descending
  results.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0
    const dateB = b.date ? new Date(b.date).getTime() : 0
    return dateB - dateA
  })

  return NextResponse.json(results.slice(0, limit))
}
