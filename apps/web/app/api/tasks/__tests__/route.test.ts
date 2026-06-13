import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '../route'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/helpers', () => ({
  authenticate: vi.fn(),
  isAuthError: vi.fn((r: unknown) => r instanceof NextResponse),
  validationError: vi.fn((issues: { path: (string | number)[]; message: string }[]) => {
    const details: Record<string, string[]> = {}
    for (const issue of issues) {
      const key = issue.path.join('.') || '_root'
      if (!details[key]) details[key] = []
      details[key]!.push(issue.message)
    }
    return NextResponse.json({ error: 'Validation error', details }, { status: 400 })
  }),
}))

import { authenticate } from '@/lib/auth/helpers'

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'
const TEST_TAG_ID = '00000000-0000-4000-8000-000000000003'

function createRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    ...(body && {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  })
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, any> = {}
  const methods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'is', 'in', 'contains', 'containedBy',
    'order', 'limit', 'range', 'filter', 'not', 'or', 'match',
  ]
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder)
  }
  builder.single = vi.fn().mockResolvedValue(result)
  builder.maybeSingle = vi.fn().mockResolvedValue(result)
  builder.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    return Promise.resolve(result).then(resolve, reject)
  }
  return builder
}

function mockAuthWithTables(
  tableResults: Record<string, { data: unknown; error: unknown } | { data: unknown; error: unknown }[]>
) {
  const callCounts: Record<string, number> = {}
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (!callCounts[table]) callCounts[table] = 0
      const entry = tableResults[table]
      let result: { data: unknown; error: unknown }
      if (Array.isArray(entry)) {
        result = entry[callCounts[table]!] ?? entry[entry.length - 1]!
      } else {
        result = entry ?? { data: null, error: null }
      }
      callCounts[table]!++
      return makeQueryBuilder(result)
    }),
  }
  vi.mocked(authenticate).mockResolvedValue({ userId: TEST_USER_ID, supabase: supabase as any })
  return supabase
}

// ── GET Tests ──────────────────────────────────────────────────────────────

describe('GET /api/tasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tasks list with tags joined', async () => {
    const tasks = [
      { id: 't1', title: 'Buy groceries', status: 'backlog' },
      { id: 't2', title: 'Write tests', status: 'in_progress' },
    ]
    const taskTags = [
      { task_id: 't1', tag_id: TEST_TAG_ID, tags: { id: TEST_TAG_ID, name: 'errands', color: '#ff0000', prefix: null } },
    ]

    mockAuthWithTables({
      tasks: { data: tasks, error: null },
      task_tags: { data: taskTags, error: null },
    })

    const req = createRequest('GET', '/api/tasks')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].tags).toHaveLength(1)
    expect(body[0].tags[0].name).toBe('errands')
    expect(body[1].tags).toHaveLength(0)
  })

  it('filters tasks by status query param', async () => {
    const tasks = [{ id: 't1', title: 'In progress task', status: 'in_progress' }]
    const supabase = mockAuthWithTables({
      tasks: { data: tasks, error: null },
      task_tags: { data: [], error: null },
    })

    const req = createRequest('GET', '/api/tasks?status=in_progress')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(supabase.from).toHaveBeenCalledWith('tasks')
  })

  it('filters tasks by board query param', async () => {
    const tasks = [{ id: 't1', title: 'Future task', board: 'future' }]
    mockAuthWithTables({
      tasks: { data: tasks, error: null },
      task_tags: { data: [], error: null },
    })

    const req = createRequest('GET', '/api/tasks?board=future')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
  })

  it('returns empty array when no tasks exist', async () => {
    mockAuthWithTables({
      tasks: { data: [], error: null },
    })

    const req = createRequest('GET', '/api/tasks')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns 500 when supabase query fails', async () => {
    mockAuthWithTables({
      tasks: { data: null, error: { message: 'DB error' } },
    })

    const req = createRequest('GET', '/api/tasks')
    const res = await GET(req)

    expect(res.status).toBe(500)
  })
})

// ── POST Tests ─────────────────────────────────────────────────────────────

describe('POST /api/tasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates task with title only (minimal) and returns 201', async () => {
    const createdTask = {
      id: 't-new',
      title: 'Quick task',
      status: 'backlog',
      board: 'current',
      importance: 'normal',
      user_id: TEST_USER_ID,
    }

    mockAuthWithTables({
      tasks: { data: createdTask, error: null },
      task_tags: { data: [], error: null },
      subtasks: { data: [], error: null },
    })

    const req = createRequest('POST', '/api/tasks', { title: 'Quick task' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.title).toBe('Quick task')
    expect(body.tags).toEqual([])
    expect(body.subtasks).toEqual([])
  })

  it('creates task with scheduled_start/end for calendar display', async () => {
    const scheduledStart = '2026-06-16T14:00:00Z'
    const scheduledEnd = '2026-06-16T15:00:00Z'
    const createdTask = {
      id: 't-sched',
      title: 'Calendar task',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: 'backlog',
      user_id: TEST_USER_ID,
    }

    mockAuthWithTables({
      tasks: { data: createdTask, error: null },
      task_tags: { data: [], error: null },
      subtasks: { data: [], error: null },
    })

    const req = createRequest('POST', '/api/tasks', {
      title: 'Calendar task',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.scheduled_start).toBe(scheduledStart)
    expect(body.scheduled_end).toBe(scheduledEnd)
  })

  it('creates task with all fields populated', async () => {
    const fullInput = {
      title: 'Full task',
      notes: 'Some notes',
      importance: 'high' as const,
      time_estimate_minutes: 60,
      earliest_start: '2026-06-14',
      due_date: '2026-06-20',
      scheduled_start: '2026-06-16T14:00:00Z',
      scheduled_end: '2026-06-16T15:00:00Z',
      location: 'Office',
      visibility: 'busy' as const,
      privacy: 'private' as const,
      flexibility: 'not_flexible' as const,
      status: 'in_progress' as const,
      board: 'current' as const,
      tag_ids: [TEST_TAG_ID],
      reminders: [{ minutes_before: 15 }],
      subtasks: [{ title: 'Subtask 1' }],
    }

    const createdTask = { id: 't-full', title: 'Full task', user_id: TEST_USER_ID }

    mockAuthWithTables({
      tasks: { data: createdTask, error: null },
      task_tags: [
        { data: null, error: null }, // insert tag_ids
        { data: [{ tag_id: TEST_TAG_ID, tags: { id: TEST_TAG_ID, name: 'work', color: '#0000ff', prefix: null } }], error: null }, // fetch tags
      ],
      subtasks: [
        { data: null, error: null }, // insert subtasks
        { data: [{ id: 'st-1', title: 'Subtask 1', completed: false, position: 1 }], error: null }, // fetch subtasks
      ],
    })

    const req = createRequest('POST', '/api/tasks', fullInput)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.title).toBe('Full task')
    expect(body.tags).toHaveLength(1)
    expect(body.subtasks).toHaveLength(1)
  })

  it('rejects empty title with 400', async () => {
    mockAuthWithTables({})

    const req = createRequest('POST', '/api/tasks', { title: '' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('rejects missing title with 400', async () => {
    mockAuthWithTables({})

    const req = createRequest('POST', '/api/tasks', { notes: 'no title here' })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('rejects invalid JSON body with 400', async () => {
    mockAuthWithTables({})

    const req = new NextRequest(new URL('/api/tasks', 'http://localhost:3000'), {
      method: 'POST',
      body: '{{invalid',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid JSON body')
  })

  it('rejects unauthenticated request with 401', async () => {
    vi.mocked(authenticate).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )

    const req = createRequest('POST', '/api/tasks', { title: 'Should fail' })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })
})
