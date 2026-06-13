'use client'

import { Command } from 'cmdk'
import type { LucideIcon } from 'lucide-react'

interface CommandItemProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  description?: string
  onSelect: () => void
}

export function CommandItem({
  icon: Icon,
  label,
  shortcut,
  description,
  onSelect,
}: CommandItemProps) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--fg)] outline-none transition-colors data-[selected=true]:bg-[var(--surface-hover)] aria-selected:bg-[var(--surface-hover)]"
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
      <div className="flex flex-1 flex-col">
        <span>{label}</span>
        {description && (
          <span className="text-xs text-[var(--muted)]">{description}</span>
        )}
      </div>
      {shortcut && (
        <kbd className="flex-shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  )
}
