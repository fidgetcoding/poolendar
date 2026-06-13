'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Command } from 'cmdk'
import {
  Calendar,
  CheckSquare,
  Clock,
  Search,
  Settings,
  Plus,
  LayoutGrid,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Repeat,
  Keyboard,
  Eye,
  EyeOff,
  Link,
} from 'lucide-react'
import { CommandItem } from './CommandItem'

interface CommandBarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSettings: () => void
}

export function CommandBar({ open, onOpenChange, onOpenSettings }: CommandBarProps) {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<
    { type: string; title: string; subtitle?: string }[]
  >([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch('')
      setSearchResults([])
    }
  }, [open])

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setSearch(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value.trim()) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(value)}`
        )
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results || [])
        }
      } catch {
        // Search API not available yet
        setSearchResults([])
      }
    }, 300)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Command palette */}
      <div className="flex items-start justify-center pt-[20vh]">
        <Command
          className="relative w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          shouldFilter={true}
          loop
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <Command.Input
              value={search}
              onValueChange={handleSearch}
              placeholder="What do you need?"
              className="h-12 flex-1 bg-transparent text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none"
              autoFocus
            />
            <kbd className="hidden rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] sm:inline-block">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[var(--muted)]">
              No results found.
            </Command.Empty>

            {/* Actions */}
            <Command.Group heading="Actions" className="mb-2">
              <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Actions
              </span>
              <CommandItem
                icon={Plus}
                label="Create Event"
                shortcut="C"
                onSelect={() => {
                  onOpenChange(false)
                  // Create event
                }}
              />
              <CommandItem
                icon={CheckSquare}
                label="Create Task"
                shortcut="N T"
                onSelect={() => {
                  onOpenChange(false)
                  // Create task
                }}
              />
              <CommandItem
                icon={Repeat}
                label="Create Routine"
                onSelect={() => {
                  onOpenChange(false)
                  // Create routine
                }}
              />
              <CommandItem
                icon={Link}
                label="Create Booking Link"
                onSelect={() => {
                  onOpenChange(false)
                  // Create booking link
                }}
              />
              <CommandItem
                icon={RefreshCw}
                label="Refresh Calendars"
                shortcut="R"
                onSelect={() => {
                  onOpenChange(false)
                  // Refresh
                }}
              />
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigation" className="mb-2">
              <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Navigation
              </span>
              <CommandItem
                icon={Calendar}
                label="Go to Today"
                shortcut="T"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Calendar}
                label="Day View"
                shortcut="D"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Calendar}
                label="Week View"
                shortcut="W"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Calendar}
                label="Month View"
                shortcut="M"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={LayoutGrid}
                label="Open Kanban Board"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={ArrowLeft}
                label="Previous Period"
                shortcut="left"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={ArrowRight}
                label="Next Period"
                shortcut="right"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
            </Command.Group>

            {/* Shortcuts */}
            <Command.Group heading="Shortcuts" className="mb-2">
              <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                Shortcuts
              </span>
              <CommandItem
                icon={Settings}
                label="Open Settings"
                shortcut="P"
                onSelect={() => {
                  onOpenChange(false)
                  onOpenSettings()
                }}
              />
              <CommandItem
                icon={CheckSquare}
                label="Toggle Task Panel"
                shortcut="Alt+A"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Clock}
                label="Toggle Booking Panel"
                shortcut="Alt+S"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Eye}
                label="Toggle Sidebar"
                shortcut="Space"
                onSelect={() => {
                  onOpenChange(false)
                }}
              />
              <CommandItem
                icon={Keyboard}
                label="List Keyboard Shortcuts"
                shortcut="."
                onSelect={() => {
                  // Show shortcuts overlay
                }}
              />
            </Command.Group>

            {/* Search results */}
            {searchResults.length > 0 && (
              <Command.Group heading="Search Results" className="mb-2">
                <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Search Results
                </span>
                {searchResults.map((result, i) => (
                  <CommandItem
                    key={`${result.type}-${i}`}
                    icon={
                      result.type === 'event'
                        ? Calendar
                        : result.type === 'task'
                          ? CheckSquare
                          : result.type === 'routine'
                            ? Repeat
                            : Search
                    }
                    label={result.title}
                    description={result.subtitle}
                    onSelect={() => {
                      onOpenChange(false)
                      // Navigate to result
                    }}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
