'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { drainQueue } from './sync'

// ---------------------------------------------------------------------------
// External store for navigator.onLine — SSR-safe via useSyncExternalStore
// ---------------------------------------------------------------------------

type Listener = () => void

const listeners = new Set<Listener>()

function subscribe(listener: Listener): () => void {
  listeners.add(listener)

  const handleOnline = () => {
    listeners.forEach((l) => l())
  }
  const handleOffline = () => {
    listeners.forEach((l) => l())
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

function getServerSnapshot(): boolean {
  return true
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnline(): { isOnline: boolean; wasOffline: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const wasOfflineRef = useRef(false)
  const isDrainingRef = useRef(false)

  // Track if the user was ever offline during this session
  if (!isOnline) {
    wasOfflineRef.current = true
  }

  const handleReconnect = useCallback(async () => {
    // Prevent concurrent drains
    if (isDrainingRef.current) return
    isDrainingRef.current = true

    try {
      const result = await drainQueue()
      if (result.succeeded > 0 || result.failed > 0) {
        console.log(
          `[sync] Drained queue after reconnect: ${result.succeeded} succeeded, ${result.failed} failed`
        )
      }
    } catch (err) {
      console.error('[sync] Failed to drain queue on reconnect:', err)
    } finally {
      isDrainingRef.current = false
    }
  }, [])

  // When transitioning from offline to online, drain the mutation queue
  const prevOnlineRef = useRef(isOnline)
  useEffect(() => {
    const wasOfflineBefore = !prevOnlineRef.current
    prevOnlineRef.current = isOnline

    if (isOnline && wasOfflineBefore) {
      handleReconnect()
    }
  }, [isOnline, handleReconnect])

  return {
    isOnline,
    wasOffline: wasOfflineRef.current,
  }
}
