'use client'

import {
  CalendarDays,
  CheckSquare,
  LayoutGrid,
  ExternalLink,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'calendar' | 'tasks' | 'kanban' | 'booking' | 'settings'

interface BottomTabBarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const TABS: { id: TabId; label: string; icon: typeof CalendarDays }[] = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { id: 'booking', label: 'Bookings', icon: ExternalLink },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-center justify-around',
        'border-t border-[var(--border)] bg-[var(--surface)]',
        'md:hidden'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5',
              'flex-1 py-2 pt-2.5',
              'transition-colors duration-150',
              active
                ? 'text-[var(--accent)]'
                : 'text-[var(--muted)] active:text-[var(--fg)]'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
