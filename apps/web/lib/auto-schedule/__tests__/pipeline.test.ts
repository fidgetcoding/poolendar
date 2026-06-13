import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSchedulingPipeline, PipelineError } from '../pipeline'

// ---------------------------------------------------------------------------
// Mock dependencies that pipeline imports
// ---------------------------------------------------------------------------
vi.mock('../scorer', () => ({
  DEFAULT_WEIGHTS: {
    urgency: 0.35,
    deadline: 0.3,
    tag_priority: 0.2,
    staleness: 0.15,
  },
  scoreTasks: vi.fn((tasks: Array<{ id: string; title: string; notes: string | null }>) =>
    tasks.map((t) => ({
      task: t,
      score: 0.5,
      components: { urgency: 0.5, deadline: 0, tag_priority: 0.5, staleness: 0 },
    })),
  ),
}))

vi.mock('../placer', () => ({
  generateFrameInstances: vi.fn(() => []),
  placeTasks: vi.fn(() => []),
}))

vi.mock('../classifier', () => ({
  classifyByKeywords: vi.fn(() => null),
  seedKeywords: vi.fn(() => []),
}))

vi.mock('../classifier-llm', () => ({
  classifyBatchByLLM: vi.fn(async () => new Map()),
}))

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------
interface QueryResult {
  data: unknown
  error: unknown
}

function createMockSupabase(overrides: {
  profile?: QueryResult
  tasks?: QueryResult
  frames?: QueryResult
  events?: QueryResult
  scheduledTasks?: QueryResult
  keywords?: QueryResult
} = {}) {
  const defaultProfile = {
    data: { settings: {} },
    error: null,
  }
  const defaultTasks = {
    data: [],
    error: null,
  }
  const defaultFrames = {
    data: [],
    error: null,
  }
  const defaultEvents = {
    data: [],
    error: null,
  }
  const defaultKeywords = {
    data: [],
    error: null,
  }

  const profile = overrides.profile ?? defaultProfile
  const tasks = overrides.tasks ?? defaultTasks
  const frames = overrides.frames ?? defaultFrames
  const events = overrides.events ?? defaultEvents
  const scheduledTasks = overrides.scheduledTasks ?? defaultEvents
  const keywords = overrides.keywords ?? defaultKeywords

  // Track which table was queried to return the right data
  let currentTable = ''

  const terminalResolver = () => {
    switch (currentTable) {
      case 'profiles':
        return profile
      case 'tasks':
        // Distinguish between unscheduled tasks query and scheduled tasks query
        // by checking if .is() was called (unscheduled query uses .is('scheduled_start', null))
        return currentQueryUsedIs ? tasks : scheduledTasks
      case 'frames':
        return frames
      case 'events':
        return events
      case 'frame_keywords':
        return keywords
      default:
        return { data: [], error: null }
    }
  }

  let currentQueryUsedIs = false

  // Build a chainable query builder that resolves based on currentTable
  const buildChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {}
    const methods = [
      'select',
      'eq',
      'is',
      'not',
      'neq',
      'gte',
      'lte',
      'order',
      'limit',
    ]

    for (const method of methods) {
      chain[method] = vi.fn((..._args: unknown[]) => {
        if (method === 'is') currentQueryUsedIs = true
        return chain
      })
    }

    // single() terminates the chain and resolves
    chain.single = vi.fn(() => Promise.resolve(terminalResolver()))

    // Make the chain itself thenable so `await supabase.from(...).select(...).eq(...)` works
    chain.then = (
      resolve: (value: unknown) => void,
      reject: (reason: unknown) => void,
    ) => {
      return Promise.resolve(terminalResolver()).then(resolve, reject)
    }

    return chain
  }

  const supabase = {
    from: vi.fn((table: string) => {
      currentTable = table
      currentQueryUsedIs = false
      return buildChain()
    }),
  }

  return supabase
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('runSchedulingPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a message when there are no unscheduled tasks', async () => {
    const supabase = createMockSupabase({
      profile: { data: { settings: {} }, error: null },
      tasks: { data: [], error: null },
    })

    const result = await runSchedulingPipeline(
      supabase as never,
      'user-1',
      7,
    )

    expect(result.placements).toEqual([])
    expect(result.message).toBe('No unscheduled tasks to schedule')
  })

  it('returns a message when there are no active frames', async () => {
    const supabase = createMockSupabase({
      profile: { data: { settings: {} }, error: null },
      tasks: {
        data: [
          {
            id: 't1',
            title: 'Test task',
            notes: null,
            importance: 'normal',
            created_at: new Date().toISOString(),
            tags: [],
          },
        ],
        error: null,
      },
      frames: { data: [], error: null },
    })

    const result = await runSchedulingPipeline(
      supabase as never,
      'user-1',
      7,
    )

    expect(result.placements).toEqual([])
    expect(result.message).toBe('No active frames configured')
  })

  it('throws PipelineError when profile query fails', async () => {
    const supabase = createMockSupabase({
      profile: { data: null, error: { message: 'DB down' } },
    })

    await expect(
      runSchedulingPipeline(supabase as never, 'user-1', 7),
    ).rejects.toThrow(PipelineError)

    await expect(
      runSchedulingPipeline(supabase as never, 'user-1', 7),
    ).rejects.toThrow('Failed to load profile')
  })

  it('throws PipelineError when tasks query fails', async () => {
    const supabase = createMockSupabase({
      profile: { data: { settings: {} }, error: null },
      tasks: { data: null, error: { message: 'Tasks table missing' } },
    })

    await expect(
      runSchedulingPipeline(supabase as never, 'user-1', 7),
    ).rejects.toThrow('Failed to load tasks')
  })

  it('throws PipelineError when frames query fails', async () => {
    const supabase = createMockSupabase({
      profile: { data: { settings: {} }, error: null },
      tasks: {
        data: [
          {
            id: 't1',
            title: 'Task',
            notes: null,
            importance: 'normal',
            created_at: new Date().toISOString(),
            tags: [],
          },
        ],
        error: null,
      },
      frames: { data: null, error: { message: 'Frames borked' } },
    })

    await expect(
      runSchedulingPipeline(supabase as never, 'user-1', 7),
    ).rejects.toThrow('Failed to load frames')
  })

  it('loads settings from user profile', async () => {
    const customSettings = {
      auto_schedule_ai_enabled: false,
      auto_schedule_weights: {
        urgency: 0.5,
        deadline: 0.2,
        tag_priority: 0.2,
        staleness: 0.1,
      },
    }

    const supabase = createMockSupabase({
      profile: { data: { settings: customSettings }, error: null },
      tasks: { data: [], error: null },
    })

    const result = await runSchedulingPipeline(
      supabase as never,
      'user-1',
      7,
    )

    expect(result.settings).toEqual(customSettings)
  })

  it('runs the full pipeline when tasks and frames are present', async () => {
    const { placeTasks } = await import('../placer')
    const mockPlaceTasks = vi.mocked(placeTasks)
    mockPlaceTasks.mockReturnValue([
      {
        task_id: 't1',
        task_title: 'Build feature',
        frame_id: 'f1',
        frame_name: 'Deep Work',
        scheduled_start: '2026-06-14T09:00:00.000Z',
        scheduled_end: '2026-06-14T09:30:00.000Z',
        score: 0.5,
      },
    ])

    const supabase = createMockSupabase({
      profile: {
        data: { settings: { auto_schedule_ai_enabled: false } },
        error: null,
      },
      tasks: {
        data: [
          {
            id: 't1',
            title: 'Build feature',
            notes: null,
            importance: 'high',
            created_at: '2026-06-10T00:00:00.000Z',
            tags: [],
          },
        ],
        error: null,
      },
      frames: {
        data: [
          {
            id: 'f1',
            name: 'Deep Work',
            description: null,
            is_active: true,
            priority_rank: 1,
            time_blocks: [{ day: 1, start: '09:00', end: '12:00' }],
            day_overrides: {},
          },
        ],
        error: null,
      },
    })

    const result = await runSchedulingPipeline(
      supabase as never,
      'user-1',
      7,
    )

    expect(result.placements).toHaveLength(1)
    expect(result.placements[0].task_id).toBe('t1')
    expect(result.placements[0].frame_name).toBe('Deep Work')
    expect(result.message).toBeUndefined()
  })

  it('skips AI classification when auto_schedule_ai_enabled is false', async () => {
    const { classifyByKeywords } = await import('../classifier')
    const { classifyBatchByLLM } = await import('../classifier-llm')

    const supabase = createMockSupabase({
      profile: {
        data: { settings: { auto_schedule_ai_enabled: false } },
        error: null,
      },
      tasks: {
        data: [
          {
            id: 't1',
            title: 'Something',
            notes: null,
            importance: 'normal',
            created_at: new Date().toISOString(),
            tags: [],
          },
        ],
        error: null,
      },
      frames: {
        data: [
          {
            id: 'f1',
            name: 'Work',
            description: null,
            is_active: true,
            priority_rank: 1,
            time_blocks: [],
            day_overrides: {},
          },
          {
            id: 'f2',
            name: 'Admin',
            description: null,
            is_active: true,
            priority_rank: 2,
            time_blocks: [],
            day_overrides: {},
          },
        ],
        error: null,
      },
    })

    await runSchedulingPipeline(supabase as never, 'user-1', 7)

    // Neither classifier should have been called
    expect(classifyByKeywords).not.toHaveBeenCalled()
    expect(classifyBatchByLLM).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// PipelineError
// ---------------------------------------------------------------------------
describe('PipelineError', () => {
  it('is an instance of Error with name "PipelineError"', () => {
    const err = new PipelineError('Something broke')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('PipelineError')
    expect(err.message).toBe('Something broke')
  })
})
