'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Undo2, Redo2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarRibbon } from '@/components/sidebar/SidebarRibbon'
import { TaskPanel } from '@/components/sidebar/TaskPanel'
import { CalendarList } from '@/components/sidebar/CalendarList'
import { CommandBar } from '@/components/command-bar/CommandBar'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { BottomTabBar } from '@/components/mobile/BottomTabBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useUndo } from '@/lib/hooks/use-undo'
import { useProfile } from '@/lib/hooks/use-profile'
import { useCalendars } from '@/lib/hooks/use-calendars'
import { useSettingsSync } from '@/lib/hooks/use-settings-sync'
import { useAppKeyboard } from '@/lib/hooks/use-app-keyboard'
import { useSidebarCalendarDrop } from '@/lib/hooks/use-sidebar-calendar-drop'
import { useOnline } from '@/lib/offline/use-online'
import { cn } from '@/lib/utils'
import type { Profile } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Offline banner
// ---------------------------------------------------------------------------

function OfflineBanner() {
  const { isOnline, wasOffline } = useOnline()
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  if (!isOnline) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium shrink-0"
        style={{
          backgroundColor: '#92400e',
          color: '#fef3c7',
        }}
      >
        <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
        You are offline. Changes will sync when reconnected.
      </div>
    )
  }

  if (showReconnected) {
    return (
      <div
        className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium shrink-0 transition-opacity duration-1000"
        style={{
          backgroundColor: '#065f46',
          color: '#d1fae5',
        }}
      >
        <span className="w-2 h-2 rounded-full bg-green-300" />
        Back online. Syncing...
      </div>
    )
  }

  return null
}

type PanelId = 'tasks' | 'calendar' | 'booking' | 'schedules' | null
type MobileTab = 'calendar' | 'tasks' | 'kanban' | 'booking' | 'settings'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelId>('calendar')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('calendar')
  const [mobileTaskPanelOpen, setMobileTaskPanelOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const calendarStore = useCalendarStore()
  const uiStore = useUIStore()
  const { undo, redo, canUndo, canRedo } = useUndo()
  const { activeDragId, handleDragStart, handleDragEnd } = useSidebarCalendarDrop()

  // Use TanStack Query for profile — provides accent color propagation
  const { data: profileData } = useProfile()

  // Single source of truth for connected calendars (#1) — replaces the old
  // duplicate local-state load. profile.settings hydrates the calendar-store.
  const { data: calendars = [] } = useCalendars()
  useSettingsSync()

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
      }
    }

    loadProfile()
  }, [supabase, router])

  // Seed calendar visibility from the loaded calendar list.
  useEffect(() => {
    if (calendars.length > 0) {
      calendarStore.setAllCalendarsVisible(calendars.map((c) => c.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendars])

  // Apply accent color CSS variable from user settings
  const accentColor = profileData?.settings?.theme_accent_color ?? profile?.settings?.theme_accent_color
  useEffect(() => {
    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor)
      document.documentElement.style.setProperty('--accent', accentColor)
    }
  }, [accentColor])

  useAppKeyboard({
    undo,
    redo,
    toggleCommandBar: () => setCommandBarOpen((o) => !o),
    openCommandBar: () => setCommandBarOpen(true),
    openSettings: () => setSettingsOpen(true),
  })
  function handleMobileTab(tab: MobileTab) {
    setMobileTab(tab)
    if (tab === 'tasks') {
      setMobileTaskPanelOpen(true)
      setActivePanel('tasks')
    } else if (tab === 'kanban') {
      setActivePanel('tasks')
      uiStore.setTaskPanelViewMode('board')
    } else if (tab === 'booking') {
      setActivePanel('booking')
    } else if (tab === 'settings') {
      setSettingsOpen(true)
    } else {
      setActivePanel('calendar')
      setMobileTaskPanelOpen(false)
    }
  }

  return (
    <DndContext
      id="calendar-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-[var(--bg)]">
        {/* Desktop sidebar -- hidden on mobile */}
        <div className="hidden md:flex">
          <SidebarRibbon
            activePanel={activePanel}
            isExpanded={sidebarExpanded}
            onToggleTasks={() =>
              setActivePanel((p) => (p === 'tasks' ? 'calendar' : 'tasks'))
            }
            onCalendarView={() => setActivePanel('calendar')}
            onToggleBooking={() =>
              setActivePanel((p) => (p === 'booking' ? 'calendar' : 'booking'))
            }
            onSettings={() => setSettingsOpen(true)}
            onToggleExpand={() => setSidebarExpanded((e) => !e)}
          />
        </div>

        {/* Task sidebar panel -- desktop only */}
        {activePanel === 'tasks' && (
          <div className="hidden md:flex w-[280px] shrink-0 overflow-hidden flex-col">
            <TaskPanel />
            <div className="border-t border-[var(--border)] p-2">
              <CalendarList
                calendars={calendars}
                onToggle={(calendarId) =>
                  calendarStore.toggleCalendarVisibility(calendarId)
                }
                onAddAccount={() => {
                  setSettingsOpen(true)
                  uiStore.setActiveSettingsPanel('calendars')
                }}
              />
            </div>
          </div>
        )}

        {/* Mobile task panel -- full-screen overlay */}
        {mobileTaskPanelOpen && (
          <div
            className={cn(
              'fixed inset-0 z-40 flex flex-col md:hidden',
              'bg-[var(--bg)]',
              'animate-in slide-in-from-bottom duration-300'
            )}
          >
            {/* Mobile task panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
              {/* Drag handle (visual only) */}
              <div className="flex-1 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileTaskPanelOpen(false)
                  setMobileTab('calendar')
                }}
                aria-label="Close task panel"
                className="absolute right-3 top-3 p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <TaskPanel
                onTaskClick={(id) => {
                  uiStore.openEditForm(id, 'task')
                  setMobileTaskPanelOpen(false)
                  setMobileTab('calendar')
                }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Offline indicator */}
          <OfflineBanner />

          {/* Undo/Redo top bar */}
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 shrink-0',
              'border-b border-[var(--border)] bg-[var(--surface)]'
            )}
          >
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded',
                'transition-colors duration-150',
                canUndo
                  ? 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
                  : 'text-[var(--border)] cursor-not-allowed'
              )}
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded',
                'transition-colors duration-150',
                canRedo
                  ? 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]'
                  : 'text-[var(--border)] cursor-not-allowed'
              )}
            >
              <Redo2 size={16} />
            </button>
          </div>

          {/* Add bottom padding on mobile for the tab bar */}
          <main className="flex-1 overflow-hidden pb-14 md:pb-0">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar activeTab={mobileTab} onTabChange={handleMobileTab} />

      <CommandBar
        open={commandBarOpen}
        onOpenChange={setCommandBarOpen}
        onOpenSettings={() => {
          setCommandBarOpen(false)
          setSettingsOpen(true)
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={profile}
        onProfileUpdate={setProfile}
      />

      <DragOverlay>
        {activeDragId ? (
          <div className="rounded-lg border border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] shadow-lg">
            Moving...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
