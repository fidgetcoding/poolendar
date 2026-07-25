'use client'

import * as React from 'react'
import {
  CheckSquare,
  CalendarDays,
  CalendarClock,
  Clock,
  Moon,
  Settings,
  Sun,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

interface SidebarRibbonProps {
  activePanel: 'tasks' | 'calendar' | 'booking' | 'schedules' | null
  isExpanded: boolean
  onToggleTasks: () => void
  onCalendarView: () => void
  onToggleBooking: () => void
  onSettings: () => void
  onToggleExpand: () => void
}

type NavItem = {
  id: 'tasks' | 'calendar' | 'booking' | 'schedules'
  label: string
  icon: typeof CheckSquare
  onClick: () => void
  disabled?: boolean
}

function Tooltip({
  label,
  visible,
  children,
}: {
  label: string
  visible: boolean
  children: React.ReactNode
}) {
  const [show, setShow] = React.useState(false)

  if (!visible) {
    return <>{children}</>
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          role="tooltip"
          className={cn(
            'absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2',
            'whitespace-nowrap rounded-md px-2.5 py-1',
            'bg-[var(--surface)] text-xs text-[var(--fg)]',
            'border border-[var(--border)]',
            'pointer-events-none shadow-lg'
          )}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function ThemeToggleButton({ isExpanded }: { isExpanded: boolean }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Light mode' : 'Dark mode'
  const Icon = isDark ? Sun : Moon

  return (
    <Tooltip label={label} visible={!isExpanded}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        className={cn(
          'relative flex items-center gap-3 rounded-md',
          'text-[var(--muted)] transition-colors duration-150',
          'hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
          isExpanded ? 'h-10 px-3' : 'h-12 w-10 justify-center'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {isExpanded && (
          <span className="truncate text-sm font-medium">{label}</span>
        )}
      </button>
    </Tooltip>
  )
}

export function SidebarRibbon({
  activePanel,
  isExpanded,
  onToggleTasks,
  onCalendarView,
  onToggleBooking,
  onSettings,
  onToggleExpand,
}: SidebarRibbonProps) {
  const navItems: NavItem[] = [
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, onClick: onToggleTasks },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, onClick: onCalendarView },
    { id: 'booking', label: 'Booking', icon: CalendarClock, onClick: onToggleBooking },
    { id: 'schedules', label: 'Schedules', icon: Clock, onClick: () => {}, disabled: true },
  ]

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex h-full flex-col justify-between',
        'border-r border-[var(--border)] bg-[var(--bg)]',
        'transition-[width] duration-200 ease-in-out',
        isExpanded ? 'w-[200px]' : 'w-12'
      )}
    >
      <div className="flex flex-col gap-0.5 pt-2 px-1">
        {navItems.map((item) => {
          const active = activePanel === item.id
          const Icon = item.icon

          return (
            <Tooltip key={item.id} label={item.label} visible={!isExpanded}>
              <button
                type="button"
                onClick={item.onClick}
                disabled={item.disabled}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-md',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  isExpanded ? 'h-10 px-3' : 'h-12 w-10 justify-center',
                  item.disabled && 'pointer-events-none opacity-40',
                  !item.disabled && !active && 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
                  active && 'text-[var(--accent)]'
                )}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]"
                    aria-hidden="true"
                  />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {isExpanded && (
                  <span className="truncate text-sm font-medium">
                    {item.label}
                  </span>
                )}
              </button>
            </Tooltip>
          )
        })}
      </div>

      <div className="flex flex-col gap-0.5 pb-2 px-1">
        <div className="mx-2 mb-1 border-t border-[var(--border)]" />

        <ThemeToggleButton isExpanded={isExpanded} />

        <Tooltip label="Settings" visible={!isExpanded}>
          <button
            type="button"
            onClick={onSettings}
            aria-label="Settings"
            className={cn(
              'relative flex items-center gap-3 rounded-md',
              'text-[var(--muted)] transition-colors duration-150',
              'hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              isExpanded ? 'h-10 px-3' : 'h-12 w-10 justify-center'
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {isExpanded && (
              <span className="truncate text-sm font-medium">Settings</span>
            )}
          </button>
        </Tooltip>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={cn(
            'flex items-center gap-3 rounded-md',
            'text-[var(--muted)] transition-colors duration-150',
            'hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
            isExpanded ? 'h-10 px-3' : 'h-12 w-10 justify-center'
          )}
        >
          {isExpanded ? (
            <>
              <ChevronsLeft className="h-5 w-5 shrink-0" />
              <span className="truncate text-sm font-medium">Collapse</span>
            </>
          ) : (
            <ChevronsRight className="h-5 w-5 shrink-0" />
          )}
        </button>
      </div>
    </nav>
  )
}
