'use client'

import { List, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores/ui-store'

/**
 * Sidebar-list ⇄ full-board toggle (#37). Reads/writes the single
 * `taskPanelViewMode` source so the task panel and the kanban header stay in
 * lockstep — board mode is the desktop kanban entry point.
 */
export function PanelViewToggle() {
  const mode = useUIStore((s) => s.taskPanelViewMode)
  const setMode = useUIStore((s) => s.setTaskPanelViewMode)

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-[var(--border)] p-0.5">
      <button
        type="button"
        onClick={() => setMode('sidebar')}
        aria-label="List view"
        aria-pressed={mode === 'sidebar'}
        title="List view"
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded transition-colors',
          mode === 'sidebar'
            ? 'bg-[var(--surface-hover)] text-[var(--fg)]'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'
        )}
      >
        <List size={14} />
      </button>
      <button
        type="button"
        onClick={() => setMode('board')}
        aria-label="Board view"
        aria-pressed={mode === 'board'}
        title="Board view"
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded transition-colors',
          mode === 'board'
            ? 'bg-[var(--surface-hover)] text-[var(--fg)]'
            : 'text-[var(--muted)] hover:text-[var(--fg)]'
        )}
      >
        <LayoutGrid size={14} />
      </button>
    </div>
  )
}
