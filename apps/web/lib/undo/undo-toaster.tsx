'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useUndoContext } from './undo-context'

// ---------------------------------------------------------------------------
// Renders the grace-window toasts for destructive ops (#72e). For each pending
// operation it shows a sonner toast with an Undo action; sonner's own timer
// gives the countdown. When the op leaves the pending set (committed or
// undone) the toast is dismissed. Renders nothing itself — mount once inside
// <UndoProvider>.
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<string, string> = {
  delete: 'Deleted',
  complete: 'Completed',
  move: 'Moved',
}

export function UndoToaster() {
  const { pendingOperations, cancelPending } = useUndoContext()
  const shownRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const activeIds = new Set(pendingOperations.map((p) => p.id))

    // Dismiss toasts whose op is no longer pending.
    for (const id of Array.from(shownRef.current)) {
      if (!activeIds.has(id)) {
        toast.dismiss(id)
        shownRef.current.delete(id)
      }
    }

    // Show a toast for each newly-pending op.
    for (const op of pendingOperations) {
      if (shownRef.current.has(op.id)) continue
      shownRef.current.add(op.id)

      const remaining = Math.max(1_000, op.expiresAt - Date.now())
      const verb = ACTION_LABEL[op.type] ?? 'Updated'

      toast(`${verb} ${op.entityType}`, {
        id: op.id,
        duration: remaining,
        action: {
          label: 'Undo',
          onClick: () => cancelPending(op.id),
        },
      })
    }
  }, [pendingOperations, cancelPending])

  return null
}
