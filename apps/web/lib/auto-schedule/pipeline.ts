import type { SupabaseClient } from '@supabase/supabase-js'
import type { AutoSchedulePlacement } from '@poolendar/types'
import { scoreTasks, DEFAULT_WEIGHTS } from './scorer'
import type { ScoredTask } from './scorer'
import { generateFrameInstances, placeTasks } from './placer'
import { classifyByKeywords, seedKeywords } from './classifier'
import { classifyBatchByLLM } from './classifier-llm'

export interface PipelineResult {
  placements: AutoSchedulePlacement[]
  scored: ScoredTask[]
  settings: Record<string, unknown>
  message?: string
}

/**
 * Shared auto-schedule pipeline used by both preview and run routes.
 * Loads profile settings, unscheduled tasks, active frames, existing blocks,
 * runs scoring + classification + placement.
 *
 * Returns null with a message if there's nothing to schedule.
 */
export async function runSchedulingPipeline(
  supabase: SupabaseClient,
  userId: string,
  windowDays: number,
): Promise<PipelineResult> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()

  if (profileError) {
    throw new PipelineError('Failed to load profile')
  }

  const settings = (profile?.settings as Record<string, unknown>) ?? {}
  const weights =
    (settings.auto_schedule_weights as { urgency: number; deadline: number; tag_priority: number; staleness: number }) ??
    DEFAULT_WEIGHTS
  const aiEnabled = (settings.auto_schedule_ai_enabled as boolean) ?? false

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, tags:task_tags(tag_id, tags(id, name, priority_rank))')
    .eq('user_id', userId)
    .is('scheduled_start', null)
    .not('status', 'eq', 'done')
    .eq('is_split', false)

  if (tasksError) {
    throw new PipelineError('Failed to load tasks')
  }

  if (!tasks?.length) {
    return { placements: [], scored: [], settings, message: 'No unscheduled tasks to schedule' }
  }

  const normalizedTasks = tasks.map((t: Record<string, unknown>) => ({
    ...t,
    tags:
      (t.tags as Array<{ tags: unknown }>)
        ?.map((tt) => tt.tags)
        .filter(Boolean) ?? [],
  }))

  const scored = scoreTasks(normalizedTasks as Parameters<typeof scoreTasks>[0], weights)

  const { data: frames, error: framesError } = await supabase
    .from('frames')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority_rank', { ascending: true })

  if (framesError) {
    throw new PipelineError('Failed to load frames')
  }

  if (!frames?.length) {
    return { placements: [], scored, settings, message: 'No active frames configured' }
  }

  const now = new Date()
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + windowDays)

  const [eventsResult, scheduledTasksResult] = await Promise.all([
    supabase
      .from('events')
      .select('start_time, end_time')
      .eq('user_id', userId)
      .gte('end_time', now.toISOString())
      .lte('start_time', endDate.toISOString()),
    supabase
      .from('tasks')
      .select('scheduled_start, scheduled_end')
      .eq('user_id', userId)
      .not('scheduled_start', 'is', null)
      .gte('scheduled_end', now.toISOString())
      .lte('scheduled_start', endDate.toISOString()),
  ])

  const existingBlocks = [
    ...(eventsResult.data ?? []).map((e) => ({
      start: new Date((e as { start_time: string }).start_time),
      end: new Date((e as { end_time: string }).end_time),
    })),
    ...(scheduledTasksResult.data ?? []).map((t) => ({
      start: new Date((t as { scheduled_start: string }).scheduled_start),
      end: new Date((t as { scheduled_end: string }).scheduled_end),
    })),
  ]

  const frameInstances = generateFrameInstances(frames as Parameters<typeof generateFrameInstances>[0], now, endDate, existingBlocks)

  const classifications = new Map<string, string>()
  if (aiEnabled && frames.length > 1) {
    const { data: keywords } = await supabase
      .from('frame_keywords')
      .select('frame_id, keyword, weight')
      .eq('user_id', userId)

    const frameNameMap = new Map(
      (frames as Array<{ id: string; name: string }>).map((f) => [f.id, f.name]),
    )
    const keywordEntries = (keywords ?? []).map((k: Record<string, unknown>) => ({
      ...k,
      frame_name: frameNameMap.get(k.frame_id as string) ?? '',
    }))

    const allKeywords =
      keywordEntries.length > 0
        ? keywordEntries
        : seedKeywords(frames as Parameters<typeof seedKeywords>[0])

    // Keyword classification pass (synchronous, fast)
    const needsLLM: { id: string; title: string; notes: string | null }[] = []
    for (const st of scored) {
      const result = classifyByKeywords(
        st.task.title,
        st.task.notes,
        allKeywords as Parameters<typeof classifyByKeywords>[2],
      )
      if (result) {
        classifications.set(st.task.id, result.frame_id)
      } else {
        needsLLM.push({ id: st.task.id, title: st.task.title, notes: st.task.notes })
      }
    }

    // LLM classification pass (concurrent batch with concurrency cap)
    if (needsLLM.length > 0) {
      const frameInfos = (frames as Array<{ id: string; name: string; description: string | null }>).map(
        (f) => ({ id: f.id, name: f.name, description: f.description }),
      )
      const llmResults = await classifyBatchByLLM(needsLLM, frameInfos)
      for (const [taskId, frameId] of llmResults) {
        classifications.set(taskId, frameId)
      }
    }
  }

  const placements = placeTasks(scored, frameInstances, classifications)

  return { placements, scored, settings }
}

export class PipelineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipelineError'
  }
}
