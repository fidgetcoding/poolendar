import type { SupabaseClient } from '@supabase/supabase-js'
import { tokenize } from './classifier'

const CORRECTION_THRESHOLD = 3

export async function recordCorrection(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  taskTitle: string,
  fromFrameId: string | null,
  toFrameId: string,
): Promise<void> {
  await supabase.from('frame_corrections').insert({
    user_id: userId,
    task_id: taskId,
    task_title: taskTitle,
    from_frame_id: fromFrameId,
    to_frame_id: toFrameId,
  })

  const keywords = tokenize(taskTitle)

  for (const keyword of keywords) {
    // Count how many corrections moved this keyword to the same target frame
    const { count } = await supabase
      .from('frame_corrections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('to_frame_id', toFrameId)
      .ilike('task_title', `%${keyword.replace(/[_%]/g, '\\$&')}%`)

    if ((count ?? 0) >= CORRECTION_THRESHOLD) {
      // Promote: upsert a high-weight keyword for the target frame
      await supabase.from('frame_keywords').upsert(
        {
          user_id: userId,
          frame_id: toFrameId,
          keyword,
          weight: 1.5,
          source: 'correction' as const,
        },
        { onConflict: 'user_id,frame_id,keyword' },
      )

      // Downweight the old mapping if one exists
      if (fromFrameId) {
        const { data: existing } = await supabase
          .from('frame_keywords')
          .select('id')
          .eq('user_id', userId)
          .eq('frame_id', fromFrameId)
          .eq('keyword', keyword)
          .single()

        if (existing) {
          await supabase
            .from('frame_keywords')
            .update({ weight: 0.3 })
            .eq('id', existing.id)
        }
      }
    }
  }
}

export async function getCorrections(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
) {
  const { data, error } = await supabase
    .from('frame_corrections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}
