'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, DragOverlay, closestCenter, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { SidebarRibbon } from '@/components/sidebar/SidebarRibbon'
import { CommandBar } from '@/components/command-bar/CommandBar'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import type { Profile } from '@poolendar/types'

type PanelId = 'tasks' | 'calendar' | 'booking' | 'schedules' | null

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [commandBarOpen, setCommandBarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<PanelId>('calendar')
  const [sidebarExpanded, setSidebarExpanded] = useState(false)

  const calendarStore = useCalendarStore()
  const uiStore = useUIStore()

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

  // Global keyboard shortcut listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      // Command bar: Cmd+K / Ctrl+K (always active)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandBarOpen((o) => !o)
        return
      }

      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault()
          // undo-store integration point
        }
        return
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (!isInput) {
          e.preventDefault()
          // undo-store integration point
        }
        return
      }

      // Skip remaining shortcuts if user is typing in a form field
      if (isInput) return

      // Alt key combos first (before single-key checks)
      if (e.altKey) {
        switch (e.key) {
          case 'a':
          case 'A':
            e.preventDefault()
            uiStore.toggleTaskPanel()
            return
          case 's':
          case 'S':
            e.preventDefault()
            uiStore.toggleBookingPanel()
            return
          default:
            if (e.key >= '1' && e.key <= '9') {
              e.preventDefault()
              calendarStore.setCustomDays(parseInt(e.key, 10))
              calendarStore.setView('custom')
            }
            return
        }
      }

      switch (e.key) {
        case 'T':
        case 't':
          calendarStore.goToToday()
          break
        case 'D':
        case 'd':
          calendarStore.setView('day')
          break
        case 'W':
        case 'w':
          calendarStore.setView('week')
          break
        case 'M':
        case 'm':
          calendarStore.setView('month')
          break
        case 'X':
        case 'x':
          calendarStore.setView('2weeks')
          break
        case 'P':
        case 'p':
          e.preventDefault()
          setSettingsOpen(true)
          break
        case 'R':
        case 'r':
          // Refresh calendars — integration point
          break
        case 'C':
        case 'c':
          uiStore.openEditForm(null, 'event')
          break
        case 'ArrowLeft':
          calendarStore.goToPrevPeriod()
          break
        case 'ArrowRight':
          calendarStore.goToNextPeriod()
          break
        case '.':
          setCommandBarOpen(true)
          break
        case '[':
          calendarStore.zoomOut()
          break
        case ']':
          calendarStore.zoomIn()
          break
        case ' ':
          e.preventDefault()
          uiStore.toggleSidebar()
          break
        default:
          break
      }
    },
    [calendarStore, uiStore]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    // Drag-and-drop between calendar, task panel, and kanban
    // is handled by individual containers via @dnd-kit context
    const { active, over } = event
    if (!over || active.id === over.id) return
    // Integration point for cross-container drag logic
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen bg-[var(--bg)]">
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
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

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
