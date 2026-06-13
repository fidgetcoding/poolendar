import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationPayload, PushSubscriptionRecord } from './types'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@poolendar.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function sendPushNotification(
  subscription: PushSubscriptionRecord,
  payload: NotificationPayload,
  supabase?: SupabaseClient
): Promise<boolean> {
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
  }

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url,
        event: payload.event,
        data: payload.data,
      })
    )
    return true
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.warn('[notifications/push] Subscription expired, removing:', subscription.id)
      if (supabase) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', subscription.id)
      }
    } else {
      console.error('[notifications/push] Send failed:', err.statusCode, err.body)
    }
    return false
  }
}
