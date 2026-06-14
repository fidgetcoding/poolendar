'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
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
import { ContextMenu } from '@/components/calendar/ContextMenu'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useCalendarStore } from '@/lib/stores/calendar-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useUndo } from '@/lib/hooks/use-undo'
import { useProfile } from '@/lib/hooks/use-profile'
import { useUpdateTask } from '@/lib/hooks/use-tasks'
import { useUpdateRoutine } from '@/lib/hooks/use-routines'
import { useOnline } from '@/lib/offline/use-online'
import { cn } from '@/lib/utils'
import type { Profile, Calendar, Task, Routine } from '@poolendar/types'

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
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
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
  const updateTask = useUpdateTask()
  const updateRoutine = useUpdateRoutine()

  // Use TanStack Query for profile — provides accent color propagation
  const { data: profileData } = useProfile()

  const [calendars, setCalendars] = useState<Calendar[]>([])

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

      const { data: cals } = await supabase
        .from('calendars')
        .select('*')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })

      if (cals) {
        setCalendars(cals as Calendar[])
        calendarStore.setAllCalendarsVisible(cals.map((c: Calendar) => c.id))
      }
    }

    loadProfile()
  }, [supabase, router])

  // Apply accent color CSS variable from user settings
  const accentColor = profileData?.settings?.theme_accent_color ?? profile?.settings?.theme_accent_color
  useEffect(() => {
    if (accentColor) {
      document.documentElement.style.setProperty('--accent-color', accentColor)
      document.documentElement.style.setProperty('--accent', accentColor)
    }
  }, [accentColor])

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
          undo()
        }
        return
      }

      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        if (!isInput) {
          e.preventDefault()
          redo()
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
    [calendarStore, uiStore, undo, redo]
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

    const { active, over } = event
    const dragData = active.data?.current as
      | { type: string; task?: Task; routine?: Routine }
      | undefined

    if (!dragData) return

    // Handle sidebar task/routine drops onto the calendar grid.
    // Since the calendar has its own inner DndContext, we use
    // pointer coordinates to find which DayColumn was targeted.
    if (
      dragData.type === 'sidebar-task' ||
      dragData.type === 'sidebar-routine'
    ) {
      // Get the pointer position from the activator event
      const activatorEvent = event.activatorEvent as MouseEvent | TouchEvent
      let clientX: number
      let clientY: number

      const deltaX = event.delta?.x ?? 0
      const deltaY = event.delta?.y ?? 0

      if ('touches' in activatorEvent && activatorEvent.touches.length > 0) {
        clientX = activatorEvent.touches[0]!.clientX + deltaX
        clientY = activatorEvent.touches[0]!.clientY + deltaY
      } else if ('clientX' in activatorEvent) {
        clientX = (activatorEvent as MouseEvent).clientX + deltaX
        clientY = (activatorEvent as MouseEvent).clientY + deltaY
      } else {
        return
      }

      // Find the DayColumn element under the drop point
      // DayColumn droppable IDs follow the pattern: day-{ISO date}
      const elements = document.elementsFromPoint(clientX, clientY)
      const dayColumnEl = elements.find(
        (el) =>
          el instanceof HTMLElement &&
          el.dataset?.dayColumn !== undefined
      ) as HTMLElement | undefined

      // Fallback: find by checking elements with droppable data attribute
      // DayColumn sets ref on its root div
      if (!dayColumnEl) {
        // Try to find any calendar column area
        const calArea = elements.find(
          (el) =>
            el instanceof HTMLElement &&
            el.closest('[data-day-column]') !== null
        )
        if (calArea) {
          const col = (calArea as HTMLElement).closest(
            '[data-day-column]'
          ) as HTMLElement | null
          if (col) {
            handleSidebarDrop(dragData, col, clientY)
            return
          }
        }
        return
      }

      handleSidebarDrop(dragData, dayColumnEl, clientY)
      return
    }

    if (!over || active.id === over.id) return
    // Integration point for other cross-container drag logic
  }

  function handleSidebarDrop(
    dragData: { type: string; task?: Task; routine?: Routine },
    dayColumnEl: HTMLElement,
    clientY: number
  ) {
    const rect = dayColumnEl.getBoundingClientRect()
    const hourHeight = calendarStore.hourHeight || 60
    const yOffset = clientY - rect.top
    const rawMinutes = (yOffset / hourHeight) * 60
    const snappedMinutes = Math.round(rawMinutes / 15) * 15
    const clampedMinutes = Math.max(0, Math.min(24 * 60 - 15, snappedMinutes))
    const startHour = Math.floor(clampedMinutes / 60)
    const startMinute = clampedMinutes % 60

    if (dragData.type === 'sidebar-task' && dragData.task) {
      const task = dragData.task
      const duration = task.time_estimate_minutes || 30
      const endMinutes = clampedMinutes + duration
      const endHour = Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60

      // Build ISO date strings from the column date
      const dateAttr = dayColumnEl.dataset.dayColumn
      const dateStr = dateAttr || format(new Date(), 'yyyy-MM-dd')

      const scheduledStart = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
      const scheduledEnd = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`

      updateTask.mutate({
        id: task.id,
        data: { scheduled_start: scheduledStart, scheduled_end: scheduledEnd },
      })
    }

    if (dragData.type === 'sidebar-routine' && dragData.routine) {
      const routine = dragData.routine
      const dateAttr = dayColumnEl.dataset.dayColumn
      const dateStr = dateAttr || format(new Date(), 'yyyy-MM-dd')

      // Parse the routine's duration
      const startParts = routine.start_time.split('T')
      const endParts = routine.end_time.split('T')
      let durationMinutes = 60

      if (startParts.length > 1 && endParts.length > 1) {
        const sParts = (startParts[1] ?? '09:00').split(':').map(Number)
        const eParts = (endParts[1] ?? '10:00').split(':').map(Number)
        const sh = sParts[0] ?? 9
        const sm = sParts[1] ?? 0
        const eh = eParts[0] ?? 10
        const em = eParts[1] ?? 0
        durationMinutes = (eh * 60 + em) - (sh * 60 + sm)
        if (durationMinutes <= 0) durationMinutes = 60
      }

      const endMinutes = clampedMinutes + durationMinutes
      const endHour = Math.floor(endMinutes / 60)
      const endMinute = endMinutes % 60

      const newStartTime = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
      const newEndTime = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`

      updateRoutine.mutate({
        id: routine.id,
        data: { start_time: newStartTime, end_time: newEndTime },
      })
    }
  }

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

      <ContextMenu />

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
