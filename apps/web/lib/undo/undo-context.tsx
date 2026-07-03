'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useUndo } from '@/lib/hooks/use-undo'

// ---------------------------------------------------------------------------
// Undo/redo is a single session-scoped engine shared across the whole app tree
// (top-bar buttons, keyboard, grid, kanban, command bar). Every mutation site
// pushes onto the same stack via this context, and the top-bar Undo/Redo
// buttons drain it. Without a shared instance each `useUndo()` caller would get
// an isolated stack (#72d-f).
// ---------------------------------------------------------------------------

export type UndoApi = ReturnType<typeof useUndo>

/** Exported so tests can inject a spy engine without the real grace timers. */
export const UndoContext = createContext<UndoApi | null>(null)

export function UndoProvider({
  children,
  gracePeriodMs = 30_000,
}: {
  children: ReactNode
  gracePeriodMs?: number
}) {
  const undo = useUndo(gracePeriodMs)
  return <UndoContext.Provider value={undo}>{children}</UndoContext.Provider>
}

export function useUndoContext(): UndoApi {
  const ctx = useContext(UndoContext)
  if (!ctx) {
    throw new Error('useUndoContext must be used within an <UndoProvider>')
  }
  return ctx
}
