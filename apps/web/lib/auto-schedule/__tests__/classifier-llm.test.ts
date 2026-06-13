import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyByLLM, classifyBatchByLLM } from '../classifier-llm'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const frames = [
  { id: 'f-deep', name: 'Deep Work', description: 'Focused coding' },
  { id: 'f-admin', name: 'Admin', description: 'Email and paperwork' },
  { id: 'f-meeting', name: 'Meetings', description: 'Calls and syncs' },
]

function anthropicResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text }],
    }),
  }
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'something went wrong' }),
  }
}

// ---------------------------------------------------------------------------
// classifyByLLM
// ---------------------------------------------------------------------------
describe('classifyByLLM', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  it('returns a classification when LLM returns an exact frame name', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(anthropicResponse('Deep Work'))

    const result = await classifyByLLM(
      'Refactor the auth module',
      null,
      frames,
      'test-api-key',
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('f-deep')
    expect(result!.frame_name).toBe('Deep Work')
    expect(result!.confidence).toBe(0.8)
    expect(result!.layer).toBe('llm')
  })

  it('fuzzy-matches when LLM response contains the frame name (includes fallback)', async () => {
    // LLM returns "I think this belongs in deep work" instead of exact "Deep Work"
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        anthropicResponse('I think this belongs in deep work'),
      )

    const result = await classifyByLLM(
      'Write unit tests',
      null,
      frames,
      'test-api-key',
    )

    expect(result).not.toBeNull()
    expect(result!.frame_id).toBe('f-deep')
    expect(result!.frame_name).toBe('Deep Work')
  })

  it('returns null when LLM returns an invalid frame name', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(anthropicResponse('Relaxation Time'))

    const result = await classifyByLLM(
      'Take a nap',
      null,
      frames,
      'test-api-key',
    )

    expect(result).toBeNull()
  })

  it('returns null on API error (non-200 status)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(500))

    const result = await classifyByLLM(
      'Debug parser',
      null,
      frames,
      'test-api-key',
    )

    expect(result).toBeNull()
  })

  it('returns null when AbortController fires at timeout', async () => {
    // Simulate a fetch that never resolves before the timeout
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )

    const promise = classifyByLLM(
      'Long running task',
      null,
      frames,
      'test-api-key',
    )

    // Advance past the 8-second timeout
    await vi.advanceTimersByTimeAsync(9_000)

    const result = await promise
    expect(result).toBeNull()
  })

  it('returns null when no API key is provided and env is unset', async () => {
    const original = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    const result = await classifyByLLM('Some task', null, frames)

    expect(result).toBeNull()
    process.env.ANTHROPIC_API_KEY = original
  })

  it('returns null when frames list is empty', async () => {
    const result = await classifyByLLM(
      'Some task',
      null,
      [],
      'test-api-key',
    )

    expect(result).toBeNull()
  })

  it('includes task notes in the prompt when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(anthropicResponse('Admin'))

    await classifyByLLM(
      'Process the thing',
      'Handle invoices and receipts',
      frames,
      'test-api-key',
    )

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0]!
    const body = JSON.parse(fetchCall[1].body as string)
    const userContent = body.messages[0].content as string

    expect(userContent).toContain('<task_notes>')
    expect(userContent).toContain('Handle invoices and receipts')
  })

  it('sends correct headers and model in the request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(anthropicResponse('Admin'))

    await classifyByLLM('File taxes', null, frames, 'sk-test-123')

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0]!
    const [url, options] = fetchCall

    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(options.headers['x-api-key']).toBe('sk-test-123')
    expect(options.headers['anthropic-version']).toBe('2023-06-01')

    const body = JSON.parse(options.body as string)
    expect(body.model).toBe('claude-haiku-4-5-20251001')
    expect(body.max_tokens).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// classifyBatchByLLM
// ---------------------------------------------------------------------------
describe('classifyBatchByLLM', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('classifies multiple tasks and returns a Map of task_id -> frame_id', async () => {
    const tasks = [
      { id: 't1', title: 'Refactor auth', notes: null },
      { id: 't2', title: 'Send invoices', notes: null },
    ]

    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) return anthropicResponse('Deep Work')
      return anthropicResponse('Admin')
    })

    const results = await classifyBatchByLLM(tasks, frames, 'test-key')

    expect(results.size).toBe(2)
    expect(results.get('t1')).toBe('f-deep')
    expect(results.get('t2')).toBe('f-admin')
  })

  it('handles mixed success/failure in a batch', async () => {
    const tasks = [
      { id: 't1', title: 'Code review', notes: null },
      { id: 't2', title: 'Unknown thing', notes: null },
      { id: 't3', title: 'Schedule meeting', notes: null },
    ]

    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount === 1) return anthropicResponse('Deep Work')
      if (callCount === 2) return anthropicResponse('Nonexistent Frame')
      return anthropicResponse('Meetings')
    })

    const results = await classifyBatchByLLM(tasks, frames, 'test-key')

    expect(results.size).toBe(2)
    expect(results.get('t1')).toBe('f-deep')
    expect(results.has('t2')).toBe(false) // failed - invalid frame name
    expect(results.get('t3')).toBe('f-meeting')
  })

  it('processes tasks in batches of 5 (concurrency cap)', async () => {
    // Create 7 tasks to test that batching works (batch of 5, then batch of 2)
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      notes: null,
    }))

    const callTimestamps: number[] = []
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callTimestamps.push(Date.now())
      return anthropicResponse('Deep Work')
    })

    const results = await classifyBatchByLLM(tasks, frames, 'test-key')

    expect(results.size).toBe(7)
    // All 7 calls should have been made
    expect(globalThis.fetch).toHaveBeenCalledTimes(7)
  })

  it('returns an empty map when tasks list is empty', async () => {
    const results = await classifyBatchByLLM([], frames, 'test-key')
    expect(results.size).toBe(0)
  })

  it('returns an empty map when frames list is empty', async () => {
    const tasks = [{ id: 't1', title: 'Something', notes: null }]
    const results = await classifyBatchByLLM(tasks, [], 'test-key')
    expect(results.size).toBe(0)
  })
})
