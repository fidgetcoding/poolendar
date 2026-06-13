'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SearchResult } from '@poolendar/types'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Query-key factory
// ---------------------------------------------------------------------------

export const searchKeys = {
  all: ['search'] as const,
  query: (q: string, types?: string[]) =>
    [...searchKeys.all, q, ...(types ?? [])] as const,
}

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------

type SearchResultType = SearchResult['type']

function scoreResult(result: SearchResult, query: string): number {
  const lowerTitle = result.title.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (lowerTitle === lowerQuery) return 3
  if (lowerTitle.startsWith(lowerQuery)) return 2
  if (lowerTitle.includes(lowerQuery)) return 1
  return 0
}

// ---------------------------------------------------------------------------
// useSearch — debounced multi-table search
// ---------------------------------------------------------------------------

export function useSearch(
  query: string,
  types?: SearchResultType[],
) {
  const debouncedQuery = useDebouncedValue(query, 300)
  const supabase = createClient()

  const searchTypes = types ?? ['event', 'task', 'routine', 'booking_link']

  return useQuery({
    queryKey: searchKeys.query(debouncedQuery, searchTypes),
    queryFn: async (): Promise<SearchResult[]> => {
      const pattern = `%${debouncedQuery}%`
      const results: SearchResult[] = []

      const searches: Promise<void>[] = []

      if (searchTypes.includes('event')) {
        searches.push(
          supabase
            .from('events')
            .select('id, title, notes, start_time')
            .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
            .limit(20)
            .then(({ data, error }) => {
              if (error) throw error
              if (data) {
                for (const row of data) {
                  results.push({
                    type: 'event',
                    id: row.id as string,
                    title: row.title as string,
                    date: row.start_time as string | null,
                    snippet: row.notes as string | null,
                  })
                }
              }
            }),
        )
      }

      if (searchTypes.includes('task')) {
        searches.push(
          supabase
            .from('tasks')
            .select('id, title, notes, due_date')
            .or(`title.ilike.${pattern},notes.ilike.${pattern}`)
            .limit(20)
            .then(({ data, error }) => {
              if (error) throw error
              if (data) {
                for (const row of data) {
                  results.push({
                    type: 'task',
                    id: row.id as string,
                    title: row.title as string,
                    date: row.due_date as string | null,
                    snippet: row.notes as string | null,
                  })
                }
              }
            }),
        )
      }

      if (searchTypes.includes('routine')) {
        searches.push(
          supabase
            .from('routines')
            .select('id, title, start_time')
            .ilike('title', pattern)
            .limit(20)
            .then(({ data, error }) => {
              if (error) throw error
              if (data) {
                for (const row of data) {
                  results.push({
                    type: 'routine',
                    id: row.id as string,
                    title: row.title as string,
                    date: row.start_time as string | null,
                    snippet: null,
                  })
                }
              }
            }),
        )
      }

      if (searchTypes.includes('booking_link')) {
        searches.push(
          supabase
            .from('booking_links')
            .select('id, name, slug, created_at')
            .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
            .limit(20)
            .then(({ data, error }) => {
              if (error) throw error
              if (data) {
                for (const row of data) {
                  results.push({
                    type: 'booking_link',
                    id: row.id as string,
                    title: row.name as string,
                    date: row.created_at as string | null,
                    snippet: row.slug as string | null,
                  })
                }
              }
            }),
        )
      }

      await Promise.all(searches)

      // Sort by relevance: exact match > starts-with > contains
      results.sort((a, b) => {
        const scoreA = scoreResult(a, debouncedQuery)
        const scoreB = scoreResult(b, debouncedQuery)
        return scoreB - scoreA
      })

      return results
    },
    enabled: debouncedQuery.length >= 2,
    placeholderData: (prev) => prev,
  })
}
