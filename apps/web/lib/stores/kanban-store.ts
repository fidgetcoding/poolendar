'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TaskBoard } from '@poolendar/types'

interface KanbanState {
  // Active board
  activeBoard: TaskBoard

  // Column collapse state (persisted)
  collapsedColumns: Record<string, boolean>

  // Project/tag filter
  activeTagFilter: string | null

  // Actions
  setActiveBoard: (board: TaskBoard) => void
  toggleColumn: (columnKey: string) => void
  setColumnCollapsed: (columnKey: string, collapsed: boolean) => void
  setActiveTagFilter: (tagId: string | null) => void
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set) => ({
      activeBoard: 'current',
      collapsedColumns: {},
      activeTagFilter: null,

      setActiveBoard: (board) => set({ activeBoard: board }),

      toggleColumn: (columnKey) =>
        set((state) => ({
          collapsedColumns: {
            ...state.collapsedColumns,
            [columnKey]: !state.collapsedColumns[columnKey],
          },
        })),

      setColumnCollapsed: (columnKey, collapsed) =>
        set((state) => ({
          collapsedColumns: {
            ...state.collapsedColumns,
            [columnKey]: collapsed,
          },
        })),

      setActiveTagFilter: (tagId) => set({ activeTagFilter: tagId }),
    }),
    {
      name: 'poolendar-kanban-store',
    }
  )
)
