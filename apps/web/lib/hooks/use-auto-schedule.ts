'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AutoSchedulePlacement, AutoScheduleStatus, TaskClassification } from '@poolendar/types'
import { taskKeys } from './use-tasks'
import { frameKeys } from './use-frames'

// ---------------------------------------------------------------------------
// Query-key factory
// ---------------------------------------------------------------------------

export interface AutoScheduleSettings {
  enabled: boolean
  ai_classification: boolean
  scoring_weights: {
    urgency: number
    deadline: number
    tag_priority: number
    staleness: number
  }
  paused_until: string | null
}

export const autoScheduleKeys = {
  all: ['auto-schedule'] as const,
  status: () => [...autoScheduleKeys.all, 'status'] as const,
  settings: () => [...autoScheduleKeys.all, 'settings'] as const,
}

// ---------------------------------------------------------------------------
// useAutoScheduleStatus
// ---------------------------------------------------------------------------

export function useAutoScheduleStatus() {
  return useQuery({
    queryKey: autoScheduleKeys.status(),
    queryFn: async (): Promise<AutoScheduleStatus> => {
      const res = await fetch('/api/auto-schedule/status')
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })
}

// ---------------------------------------------------------------------------
// useAutoScheduleSettings — GET /api/auto-schedule/settings
// ---------------------------------------------------------------------------

export function useAutoScheduleSettings() {
  return useQuery({
    queryKey: autoScheduleKeys.settings(),
    queryFn: async (): Promise<AutoScheduleSettings> => {
      const res = await fetch('/api/auto-schedule/settings')
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })
}

// ---------------------------------------------------------------------------
// useAutoSchedulePreview — dry-run mutation
// ---------------------------------------------------------------------------

export function useAutoSchedulePreview() {
  return useMutation({
    mutationFn: async (windowDays?: number): Promise<{ placements: AutoSchedulePlacement[] }> => {
      const res = await fetch('/api/auto-schedule/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window_days: windowDays }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })
}

// ---------------------------------------------------------------------------
// useAutoScheduleRun — apply placements, invalidate tasks + status
// ---------------------------------------------------------------------------

export function useAutoScheduleRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (opts?: { confirm?: boolean; window_days?: number }): Promise<{ placements: AutoSchedulePlacement[] }> => {
      const res = await fetch('/api/auto-schedule/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts ?? { confirm: true }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: autoScheduleKeys.status() })
      // Note: frames are NOT modified by auto-schedule run (only tasks are),
      // so frameKeys invalidation is intentionally omitted here.
    },
  })
}

// ---------------------------------------------------------------------------
// useAutoScheduleUnschedule — remove all auto-placed tasks
// ---------------------------------------------------------------------------

export function useAutoScheduleUnschedule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ unscheduled_count: number }> => {
      const res = await fetch('/api/auto-schedule/unschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: autoScheduleKeys.status() })
    },
  })
}

// ---------------------------------------------------------------------------
// useClassifyTask — classify a single task into a frame
// ---------------------------------------------------------------------------

export function useClassifyTask() {
  return useMutation({
    mutationFn: async (taskId: string): Promise<TaskClassification> => {
      const res = await fetch('/api/auto-schedule/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })
}
