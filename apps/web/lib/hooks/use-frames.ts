'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Frame } from '@poolendar/types'
export type { Frame } from '@poolendar/types'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Query-key factory
// ---------------------------------------------------------------------------

export const frameKeys = {
  all: ['frames'] as const,
  lists: () => [...frameKeys.all, 'list'] as const,
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

type CreateFrameInput = Omit<Frame, 'id' | 'user_id' | 'created_at' | 'updated_at'>

type UpdateFrameInput = {
  id: string
  data: Partial<Omit<Frame, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
}

// ---------------------------------------------------------------------------
// useFrames — list all frames for the current user, ordered by priority_rank
// ---------------------------------------------------------------------------

export function useFrames() {
  const supabase = createClient()

  return useQuery({
    queryKey: frameKeys.lists(),
    queryFn: async (): Promise<Frame[]> => {
      const { data, error } = await supabase
        .from('frames')
        .select('*')
        .order('priority_rank', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return data as Frame[]
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateFrame
// ---------------------------------------------------------------------------

export function useCreateFrame() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateFrameInput): Promise<Frame> => {
      const { data, error } = await supabase
        .from('frames')
        .insert(input)
        .select('*')
        .single()

      if (error) throw error
      return data as Frame
    },

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: frameKeys.lists() })

      const previous = queryClient.getQueriesData<Frame[]>({
        queryKey: frameKeys.lists(),
      })

      const tempId = crypto.randomUUID()
      const optimistic: Frame = {
        ...input,
        id: tempId,
        user_id: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) => (old ? [...old, optimistic] : [optimistic]),
      )

      return { previous, tempId }
    },

    onSuccess: (real, _input, context) => {
      if (!context) return
      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) =>
          old
            ? old.map((f) => (f.id === context.tempId ? real : f))
            : [real],
      )
    },

    onError: (_err, _input, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: frameKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateFrame
// ---------------------------------------------------------------------------

export function useUpdateFrame() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: UpdateFrameInput): Promise<Frame> => {
      const { data: updated, error } = await supabase
        .from('frames')
        .update(data)
        .eq('id', id)
        .select('*')
        .single()

      if (error) throw error
      return updated as Frame
    },

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: frameKeys.lists() })

      const previous = queryClient.getQueriesData<Frame[]>({
        queryKey: frameKeys.lists(),
      })

      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) =>
          old
            ? old.map((f) => (f.id === id ? { ...f, ...data } : f))
            : old,
      )

      return { previous }
    },

    onError: (_err, _input, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: frameKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteFrame
// ---------------------------------------------------------------------------

export function useDeleteFrame() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('frames').delete().eq('id', id)
      if (error) throw error
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: frameKeys.lists() })

      const previous = queryClient.getQueriesData<Frame[]>({
        queryKey: frameKeys.lists(),
      })

      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) => (old ? old.filter((f) => f.id !== id) : old),
      )

      return { previous }
    },

    onError: (_err, _id, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: frameKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useToggleFrame
// ---------------------------------------------------------------------------

export function useToggleFrame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<Frame> => {
      const res = await fetch(`/api/frames/${id}/toggle`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to toggle frame')
      }
      return res.json()
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: frameKeys.lists() })

      const previous = queryClient.getQueriesData<Frame[]>({
        queryKey: frameKeys.lists(),
      })

      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) =>
          old
            ? old.map((f) =>
                f.id === id ? { ...f, is_active: !f.is_active } : f,
              )
            : old,
      )

      return { previous }
    },

    onError: (_err, _id, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: frameKeys.lists() })
    },
  })
}

// ---------------------------------------------------------------------------
// useReorderFrames — POST /api/frames/reorder with optimistic reorder
// ---------------------------------------------------------------------------

export function useReorderFrames() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (order: string[]): Promise<Frame[]> => {
      const res = await fetch('/api/frames/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to reorder frames')
      }
      return res.json()
    },

    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: frameKeys.lists() })

      const previous = queryClient.getQueriesData<Frame[]>({
        queryKey: frameKeys.lists(),
      })

      queryClient.setQueriesData<Frame[]>(
        { queryKey: frameKeys.lists() },
        (old) => {
          if (!old) return old
          const byId = new Map(old.map((f) => [f.id, f]))
          return order
            .map((id, i) => {
              const f = byId.get(id)
              return f ? { ...f, priority_rank: i } : undefined
            })
            .filter((f): f is Frame => f !== undefined)
        },
      )

      return { previous }
    },

    onError: (_err, _order, context) => {
      if (!context?.previous) return
      for (const [key, data] of context.previous) {
        queryClient.setQueryData(key, data)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: frameKeys.lists() })
    },
  })
}
