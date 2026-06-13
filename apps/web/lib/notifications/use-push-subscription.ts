'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// Query-key factory
// ---------------------------------------------------------------------------

export const pushKeys = {
  all: ['push-subscription'] as const,
  current: () => [...pushKeys.all, 'current'] as const,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i)
  }
  return out
}

async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  if (!('PushManager' in window)) return null

  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// usePushSubscription
// ---------------------------------------------------------------------------

export function usePushSubscription() {
  const queryClient = useQueryClient()
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  )

  // Track permission changes
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    setPermissionState(Notification.permission)
  }, [])

  // Query for current subscription state
  const { data: subscription, isLoading: isChecking } = useQuery({
    queryKey: pushKeys.current(),
    queryFn: getExistingSubscription,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (): Promise<PushSubscription> => {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported in this browser')
      }
      if (!('PushManager' in window)) {
        throw new Error('Push notifications are not supported in this browser')
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        throw new Error('VAPID public key is not configured')
      }

      // Request permission
      const permission = await Notification.requestPermission()
      setPermissionState(permission)

      if (permission !== 'granted') {
        throw new Error('Notification permission denied')
      }

      // Register service worker and subscribe
      const registration = await navigator.serviceWorker.ready
      const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })

      // Send subscription to server
      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))
            ),
            auth: btoa(
              String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))
            ),
          },
        }),
      })

      if (!res.ok) {
        // Roll back the browser-side subscription on server failure
        await sub.unsubscribe()
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to register push subscription')
      }

      return sub
    },
    onSuccess: (sub) => {
      queryClient.setQueryData(pushKeys.current(), sub)
    },
  })

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      const existing = await getExistingSubscription()
      if (!existing) return

      // Delete from server first
      const res = await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: existing.endpoint }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to remove push subscription')
      }

      // Then unsubscribe browser-side
      await existing.unsubscribe()
    },
    onSuccess: () => {
      queryClient.setQueryData(pushKeys.current(), null)
    },
  })

  const subscribe = useCallback(() => {
    subscribeMutation.mutate()
  }, [subscribeMutation])

  const unsubscribe = useCallback(() => {
    unsubscribeMutation.mutate()
  }, [unsubscribeMutation])

  return {
    isSubscribed: !!subscription,
    isLoading: isChecking || subscribeMutation.isPending || unsubscribeMutation.isPending,
    isSupported:
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
    permissionState,
    subscribe,
    unsubscribe,
    error: subscribeMutation.error || unsubscribeMutation.error,
  }
}
