import { NextRequest, NextResponse } from 'next/server'
import { authenticate, isAuthError, validationError } from '../../../../lib/auth/helpers'
import { classifyTaskSchema } from '@poolendar/validators'
import { classifyByKeywords, seedKeywords } from '../../../../lib/auto-schedule/classifier'
import { classifyByLLM } from '../../../../lib/auto-schedule/classifier-llm'

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request)
    if (isAuthError(auth)) return auth
    const { userId, supabase } = auth

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = classifyTaskSchema.safeParse(rawBody)
    if (!parsed.success) {
      return validationError(parsed.error.issues)
    }

    const { task_id } = parsed.data

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, notes')
      .eq('id', task_id)
      .eq('user_id', userId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const [framesResult, keywordsResult] = await Promise.all([
      supabase
        .from('frames')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('priority_rank', { ascending: true }),
      supabase
        .from('frame_keywords')
        .select('frame_id, keyword, weight')
        .eq('user_id', userId),
    ])

    const frames = framesResult.data
    if (!frames?.length) {
      return NextResponse.json({ error: 'No active frames configured' }, { status: 400 })
    }

    const keywordEntries = (keywordsResult.data ?? []).map((k: any) => ({
      ...k,
      frame_name: frames.find((f: any) => f.id === k.frame_id)?.name ?? '',
    }))

    const allKeywords = keywordEntries.length > 0 ? keywordEntries : seedKeywords(frames)

    const keywordResult = classifyByKeywords(task.title, task.notes, allKeywords)
    if (keywordResult) {
      return NextResponse.json({
        frame_id: keywordResult.frame_id,
        frame_name: keywordResult.frame_name,
        confidence: keywordResult.confidence,
        layer: 'keyword',
      })
    }

    const llmResult = await classifyByLLM(
      task.title,
      task.notes,
      frames.map((f: any) => ({ id: f.id, name: f.name, description: f.description })),
    )

    if (llmResult) {
      return NextResponse.json({
        frame_id: llmResult.frame_id,
        frame_name: llmResult.frame_name,
        confidence: llmResult.confidence,
        layer: 'llm',
      })
    }

    return NextResponse.json({
      frame_id: null,
      frame_name: null,
      confidence: 0,
      layer: 'none',
    })
  } catch (error) {
    console.error('Auto-schedule classify failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
