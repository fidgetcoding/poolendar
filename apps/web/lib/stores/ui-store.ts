'use client'

import { create } from 'zustand'

interface PreviewPopover {
  isOpen: boolean
  itemId: string | null
  itemType: 'event' | 'task' | 'routine' | null
  position: { x: number; y: number } | null
}

interface UIState {
  // Panel states
  sidebarOpen: boolean
  taskPanelOpen: boolean
  bookingPanelOpen: boolean
  settingsModalOpen: boolean
  commandBarOpen: boolean

  // Task panel mode
  taskPanelMode: 'tasks' | 'routines'
  taskPanelViewMode: 'sidebar' | 'board'

  // Preview popover
  previewPopover: PreviewPopover

  // Edit form
  editFormOpen: boolean
  editFormItemId: string | null
  editFormItemType: 'event' | 'task' | 'routine' | null
  editFormTab: 'event' | 'task' | 'routine'
  /** Seed data for create-mode (e.g. the clicked time slot). */
  editFormInitialData: Record<string, unknown> | null

  // Context menu
  contextMenu: {
    isOpen: boolean
    itemId: string | null
    itemType: 'event' | 'task' | 'routine' | null
    position: { x: number; y: number } | null
  }

  // Active settings panel
  activeSettingsPanel:
    | 'shortcuts'
    | 'calendars'
    | 'video_conferencing'
    | 'telegram'
    | 'general'
    | 'active_calendars'
    | 'tags'
    | 'availability'
    | 'booking_page'
    | 'profile'

  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleTaskPanel: () => void
  setTaskPanelOpen: (open: boolean) => void
  toggleBookingPanel: () => void
  setBookingPanelOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean) => void
  toggleCommandBar: () => void
  setCommandBarOpen: (open: boolean) => void
  setTaskPanelMode: (mode: 'tasks' | 'routines') => void
  setTaskPanelViewMode: (mode: 'sidebar' | 'board') => void
  openPreviewPopover: (
    itemId: string,
    itemType: 'event' | 'task' | 'routine',
    position: { x: number; y: number }
  ) => void
  closePreviewPopover: () => void
  openEditForm: (
    itemId: string | null,
    itemType: 'event' | 'task' | 'routine',
    tab?: 'event' | 'task' | 'routine',
    initialData?: Record<string, unknown> | null
  ) => void
  closeEditForm: () => void
  setEditFormTab: (tab: 'event' | 'task' | 'routine') => void
  openContextMenu: (
    itemId: string | null,
    itemType: 'event' | 'task' | 'routine' | null,
    position: { x: number; y: number }
  ) => void
  closeContextMenu: () => void
  setActiveSettingsPanel: (panel: UIState['activeSettingsPanel']) => void
}

const initialPreviewPopover: PreviewPopover = {
  isOpen: false,
  itemId: null,
  itemType: null,
  position: null,
}

const initialContextMenu = {
  isOpen: false,
  itemId: null as string | null,
  itemType: null as 'event' | 'task' | 'routine' | null,
  position: null as { x: number; y: number } | null,
}

export const useUIStore = create<UIState>()((set) => ({
  // Panel states
  sidebarOpen: true,
  taskPanelOpen: false,
  bookingPanelOpen: false,
  settingsModalOpen: false,
  commandBarOpen: false,

  // Task panel mode
  taskPanelMode: 'tasks',
  taskPanelViewMode: 'sidebar',

  // Preview popover
  previewPopover: { ...initialPreviewPopover },

  // Edit form
  editFormOpen: false,
  editFormItemId: null,
  editFormItemType: null,
  editFormTab: 'event',
  editFormInitialData: null,

  // Context menu
  contextMenu: { ...initialContextMenu },

  // Active settings panel
  activeSettingsPanel: 'general',

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleTaskPanel: () =>
    set((state) => ({ taskPanelOpen: !state.taskPanelOpen })),

  setTaskPanelOpen: (open) => set({ taskPanelOpen: open }),

  toggleBookingPanel: () =>
    set((state) => ({ bookingPanelOpen: !state.bookingPanelOpen })),

  setBookingPanelOpen: (open) => set({ bookingPanelOpen: open }),

  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  toggleCommandBar: () =>
    set((state) => ({ commandBarOpen: !state.commandBarOpen })),

  setCommandBarOpen: (open) => set({ commandBarOpen: open }),

  setTaskPanelMode: (mode) => set({ taskPanelMode: mode }),

  setTaskPanelViewMode: (mode) => set({ taskPanelViewMode: mode }),

  openPreviewPopover: (itemId, itemType, position) =>
    set({
      previewPopover: { isOpen: true, itemId, itemType, position },
    }),

  closePreviewPopover: () =>
    set({ previewPopover: { ...initialPreviewPopover } }),

  openEditForm: (itemId, itemType, tab, initialData) =>
    set({
      editFormOpen: true,
      editFormItemId: itemId,
      editFormItemType: itemType,
      editFormTab: tab ?? itemType,
      editFormInitialData: initialData ?? null,
      previewPopover: { ...initialPreviewPopover },
    }),

  closeEditForm: () =>
    set({
      editFormOpen: false,
      editFormItemId: null,
      editFormItemType: null,
      editFormInitialData: null,
    }),

  setEditFormTab: (tab) => set({ editFormTab: tab }),

  openContextMenu: (itemId, itemType, position) =>
    set({
      contextMenu: { isOpen: true, itemId, itemType, position },
    }),

  closeContextMenu: () => set({ contextMenu: { ...initialContextMenu } }),

  setActiveSettingsPanel: (panel) => set({ activeSettingsPanel: panel }),
}))
