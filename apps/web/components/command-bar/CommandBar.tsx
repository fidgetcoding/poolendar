'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Command } from 'cmdk'
import { format } from 'date-fns'
import {
  Calendar,
  CheckSquare,
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
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react'
import { CommandItem } from './CommandItem'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { buildCommandActions, type CommandActionHandlers, type CommandAction } from '@/lib/command-bar/actions'

interface CommandBarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSettings: (tab?: string) => void
  onRefreshCalendars: () => void
  onShowShortcuts: () => void
  /** Optional — start in search mode (⌘F). */
  startInSearch?: boolean
}

interface SearchResult {
  type: string
  id: string
  title: string
  date: string | null
  snippet: string | null
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  'create-event': Plus,
  'create-task': CheckSquare,
  'create-routine': Repeat,
  'create-booking-link': LinkIcon,
  'refresh-calendars': RefreshCw,
  'go-to-today': Calendar,
  'day-view': Calendar,
  'week-view': Calendar,
  'month-view': Calendar,
  'two-week-view': Calendar,
  'open-kanban': LayoutGrid,
  'prev-period': ArrowLeft,
  'next-period': ArrowRight,
  'open-settings': Settings,
  'toggle-task-panel': CheckSquare,
  'toggle-booking-panel': Calendar,
  'toggle-sidebar': Eye,
  'list-shortcuts': Keyboard,
}

const RESULT_ICONS: Record<string, LucideIcon> = {
  event: Calendar,
  task: CheckSquare,
  routine: Repeat,
  booking_link: LinkIcon,
}

const GROUPS: CommandAction['group'][] = ['Actions', 'Navigation', 'Shortcuts']

export function CommandBar({
  open,
  onOpenChange,
  onOpenSettings,
  onRefreshCalendars,
  onShowShortcuts,
  startInSearch = false,
}: CommandBarProps) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calendarStore = useCalendarStore()
  const uiStore = useUIStore()

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  // Reset when closed.
  useEffect(() => {
    if (!open) {
      setSearch('')
      setResults([])
    }
  }, [open])

  const handlers: CommandActionHandlers = useMemo(
    () => ({
      createEvent: () => uiStore.openEditForm(null, 'event'),
      createTask: () => uiStore.openEditForm(null, 'task'),
      createRoutine: () => uiStore.openEditForm(null, 'routine'),
      createBookingLink: () => onOpenSettings('booking'),
      refreshCalendars: () => onRefreshCalendars(),
      goToToday: () => calendarStore.goToToday(),
      dayView: () => calendarStore.setView('day'),
      weekView: () => calendarStore.setView('week'),
      monthView: () => calendarStore.setView('month'),
      twoWeekView: () => calendarStore.setView('2weeks'),
      openKanban: () => {
        uiStore.setActivePanel('tasks')
        uiStore.setTaskPanelViewMode('board')
      },
      prevPeriod: () => calendarStore.goToPrevPeriod(),
      nextPeriod: () => calendarStore.goToNextPeriod(),
      openSettings: () => onOpenSettings(),
      toggleTaskPanel: () => uiStore.toggleTaskPanel(),
      toggleBookingPanel: () => uiStore.toggleBookingPanel(),
      toggleSidebar: () => uiStore.toggleSidebar(),
      listShortcuts: () => onShowShortcuts(),
    }),
    [uiStore, calendarStore, onOpenSettings, onRefreshCalendars, onShowShortcuts]
  )

  const actions = useMemo(() => buildCommandActions(handlers), [handlers])

  const q = search.trim().toLowerCase()
  const visibleActions = q
    ? actions.filter((a) => a.label.toLowerCase().includes(q))
    : actions

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : (data?.items ?? [])
          setResults(items as SearchResult[])
        }
      } catch {
        setResults([])
      }
    }, 300)
  }, [])

  const runAction = useCallback(
    (action: CommandAction) => {
      close()
      action.run()
    },
    [close]
  )

  const selectResult = useCallback(
    (r: SearchResult) => {
      close()
      if (r.type === 'booking_link') {
        uiStore.setActivePanel('booking')
        return
      }
      // Navigate the calendar to the item's date, then open its edit form (#72b).
      if (r.date) {
        calendarStore.setSelectedDate(format(new Date(r.date), 'yyyy-MM-dd'))
      }
      const itemType = r.type === 'event' ? 'event' : r.type === 'routine' ? 'routine' : 'task'
      uiStore.openEditForm(r.id, itemType)
    },
    [close, calendarStore, uiStore]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      <div className="flex items-start justify-center pt-[20vh]">
        <Command
          className="relative w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
          shouldFilter={false}
          loop
        >
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
            <Search className="h-4 w-4 text-[var(--muted)]" />
            <Command.Input
              value={search}
              onValueChange={handleSearch}
              placeholder={startInSearch ? 'Search everything…' : 'What do you need?'}
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

            {GROUPS.map((group) => {
              const items = visibleActions.filter((a) => a.group === group)
              if (items.length === 0) return null
              return (
                <Command.Group key={group} heading={group} className="mb-2">
                  <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {group}
                  </span>
                  {items.map((action) => (
                    <CommandItem
                      key={action.id}
                      icon={ACTION_ICONS[action.id] ?? Search}
                      label={action.label}
                      shortcut={action.shortcut}
                      onSelect={() => runAction(action)}
                    />
                  ))}
                </Command.Group>
              )
            })}

            {results.length > 0 && (
              <Command.Group heading="Search Results" className="mb-2">
                <span className="mb-1 block px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Search Results
                </span>
                {results.map((r, i) => (
                  <CommandItem
                    key={`${r.type}-${r.id}-${i}`}
                    icon={RESULT_ICONS[r.type] ?? Search}
                    label={r.title}
                    description={r.snippet ?? undefined}
                    onSelect={() => selectResult(r)}
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
