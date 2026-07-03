'use client'

import * as React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTags } from '@/lib/hooks/use-tags'
import {
  isViewFilterActive,
  EMPTY_VIEW_FILTER,
  type TaskViewFilter,
} from '@/lib/tasks/grouping'
import type { TaskImportance } from '@poolendar/types'

const IMPORTANCE_LEVELS: TaskImportance[] = ['highest', 'high', 'normal', 'low', 'lowest']

/**
 * The task-panel "View" filter (#36): filter the list by tag/project (tags
 * double as projects, #61) and importance. Extracted from TaskPanel to keep
 * that file under the 500-line cap.
 */
export function ViewFilterMenu({
  filter,
  onChange,
}: {
  filter: TaskViewFilter
  onChange: (f: TaskViewFilter) => void
}) {
  const [open, setOpen] = React.useState(false)
  const { data: tags = [] } = useTags()
  const active = isViewFilterActive(filter)

  function toggleTag(id: string) {
    const next = filter.tagIds.includes(id)
      ? filter.tagIds.filter((t) => t !== id)
      : [...filter.tagIds, id]
    onChange({ ...filter, tagIds: next })
  }

  function toggleImportance(level: TaskImportance) {
    const next = filter.importance.includes(level)
      ? filter.importance.filter((l) => l !== level)
      : [...filter.importance, level]
    onChange({ ...filter, importance: next })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Filter tasks"
        title="Filter (tag · importance)"
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded transition-colors duration-150',
          active
            ? 'text-[var(--accent)] bg-[var(--surface-hover)]'
            : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
        )}
      >
        <SlidersHorizontal size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-7 z-20 w-56 rounded-lg border p-2 shadow-xl"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Importance
            </div>
            <div className="flex flex-wrap gap-1 pb-2">
              {IMPORTANCE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleImportance(level)}
                  className={cn(
                    'text-[11px] capitalize px-1.5 py-0.5 rounded border transition-colors',
                    filter.importance.includes(level)
                      ? 'border-[var(--accent)] text-[var(--fg)]'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Tags / Projects
            </div>
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {tags.length === 0 && (
                <span className="px-1 text-xs text-[var(--muted)]">No tags yet</span>
              )}
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'flex items-center gap-2 px-1.5 py-1 rounded text-xs transition-colors text-left',
                    filter.tagIds.includes(tag.id)
                      ? 'bg-[var(--surface-hover)] text-[var(--fg)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-hover)]'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate">
                    {tag.prefix ? `${tag.prefix} ${tag.name}` : tag.name}
                  </span>
                </button>
              ))}
            </div>

            {active && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_VIEW_FILTER)}
                className="mt-2 w-full rounded px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
              >
                Clear filters
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
