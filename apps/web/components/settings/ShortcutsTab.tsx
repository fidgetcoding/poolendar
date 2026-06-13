'use client'

import { SHORTCUT_DEFINITIONS, formatShortcut } from '@/lib/hooks/use-keyboard'
import { SettingsSection } from './SettingsSection'

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  quick_access: 'Quick Access',
  calendar: 'Calendar Views',
  items: 'Events & Tasks',
}

const CATEGORY_ORDER = ['general', 'quick_access', 'calendar', 'items']

export function ShortcutsTab() {
  const entries = Object.entries(SHORTCUT_DEFINITIONS)

  const grouped = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      acc[cat] = entries.filter(([, def]) => def.category === cat)
      return acc
    },
    {} as Record<string, typeof entries>
  )

  return (
    <>
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat]
        if (!items || items.length === 0) return null

        return (
          <SettingsSection key={cat} title={CATEGORY_LABELS[cat] ?? cat}>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)]">
              {items.map(([key, def]) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="text-sm text-[var(--fg)]">{def.label}</span>
                  <kbd className="rounded bg-[var(--surface)] px-2 py-0.5 text-xs font-mono text-[var(--muted)] border border-[var(--border)]">
                    {formatShortcut(def)}
                  </kbd>
                </div>
              ))}
            </div>
          </SettingsSection>
        )
      })}
    </>
  )
}
