'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SHORTCUT_DEFINITIONS, formatShortcut } from '@/lib/hooks/use-keyboard'

// ---------------------------------------------------------------------------
// The `.` / `?` / `/` shortcut list overlay (#71). Reads the single
// SHORTCUT_DEFINITIONS source so it can never drift from the live handler or the
// Settings > Shortcuts tab.
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  quick_access: 'Quick Access',
  calendar: 'Calendar Views',
  items: 'Events & Tasks',
}

const CATEGORY_ORDER = ['general', 'quick_access', 'calendar', 'items']

export function ShortcutOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const entries = Object.entries(SHORTCUT_DEFINITIONS)
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: entries.filter(([, def]) => def.category === cat),
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b px-5 py-3"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold text-[var(--fg)]">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
          {grouped.map(({ cat, items }) =>
            items.length === 0 ? null : (
              <div key={cat}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map(([key, def]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[var(--fg)]">{def.label}</span>
                      <kbd className="rounded border px-1.5 py-0.5 text-xs font-mono text-[var(--muted)]"
                        style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                        {formatShortcut(def)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
