'use client'

import * as React from 'react'
import { Bell, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReminderEditorProps {
  reminders: { minutes_before: number }[]
  onChange: (reminders: { minutes_before: number }[]) => void
}

const PRESETS = [
  { label: '5m', minutes: 5 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1hr', minutes: 60 },
] as const

function formatReminderLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} before`
  }
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (remaining === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''} before`
  }
  return `${hours}h ${remaining}m before`
}

export function ReminderEditor({ reminders, onChange }: ReminderEditorProps) {
  const [customValue, setCustomValue] = React.useState('')

  function addReminder(minutes: number) {
    if (reminders.some((r) => r.minutes_before === minutes)) return
    onChange([...reminders, { minutes_before: minutes }])
  }

  function removeReminder(index: number) {
    onChange(reminders.filter((_, i) => i !== index))
  }

  function handleAddCustom() {
    const parsed = parseInt(customValue, 10)
    if (isNaN(parsed) || parsed <= 0) return
    addReminder(parsed)
    setCustomValue('')
  }

  function handleCustomKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddCustom()
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <Bell size={14} className="text-[var(--muted)]" />
        <span>Reminders</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESETS.map((preset) => {
          const isActive = reminders.some(
            (r) => r.minutes_before === preset.minutes
          )
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => addReminder(preset.minutes)}
              disabled={isActive}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md',
                'border border-[var(--border)]',
                'transition-colors duration-150',
                isActive
                  ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)] cursor-default'
                  : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--accent)]'
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {reminders.length > 0 && (
        <div className="space-y-1.5">
          {reminders
            .slice()
            .sort((a, b) => a.minutes_before - b.minutes_before)
            .map((reminder, index) => (
              <div
                key={`${reminder.minutes_before}-${index}`}
                className={cn(
                  'flex items-center justify-between',
                  'px-3 py-1.5 rounded-md',
                  'bg-[var(--bg)] border border-[var(--border)]'
                )}
              >
                <span className="text-sm text-[var(--fg)]">
                  {formatReminderLabel(reminder.minutes_before)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    removeReminder(
                      reminders.findIndex(
                        (r) => r.minutes_before === reminder.minutes_before
                      )
                    )
                  }
                  className={cn(
                    'flex items-center justify-center w-5 h-5 rounded',
                    'text-[var(--muted)] hover:text-[var(--destructive)]',
                    'transition-colors duration-150'
                  )}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={customValue}
          onChange={(e) => setCustomValue(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          placeholder="Minutes"
          className={cn(
            'flex-1 px-3 py-1.5 text-sm rounded-md',
            'bg-[var(--bg)] border border-[var(--border)]',
            'text-[var(--fg)] placeholder:text-[var(--muted)]',
            'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]'
          )}
        />
        <button
          type="button"
          onClick={handleAddCustom}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 text-sm rounded-md',
            'text-[var(--muted)] hover:text-[var(--fg)]',
            'border border-[var(--border)] hover:border-[var(--accent)]',
            'transition-colors duration-150'
          )}
        >
          <Plus size={12} />
          <span>Add</span>
        </button>
      </div>
    </div>
  )
}
