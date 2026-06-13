'use client'

import { Bell, Mail, Smartphone, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { SettingsSection, SettingsToggle } from './SettingsSection'
import type { UserSettings, NotificationSettings } from '@poolendar/types'

interface NotificationsTabProps {
  settings: UserSettings
  onChange: (partial: Partial<UserSettings>) => void
  onNotificationChange: (
    channel: keyof NotificationSettings,
    key: string,
    value: boolean
  ) => void
}

const CHANNELS: {
  id: keyof NotificationSettings
  label: string
  icon: typeof Bell
  description: string
}[] = [
  {
    id: 'browser_push',
    label: 'Push Notifications',
    icon: Smartphone,
    description: 'Browser push notifications',
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Email notifications',
  },
  {
    id: 'in_app',
    label: 'In-App',
    icon: Bell,
    description: 'In-app toast notifications',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: MessageCircle,
    description: 'Telegram bot messages',
  },
]

const EVENT_TYPES = [
  { key: 'reminders', label: 'Reminders' },
  { key: 'due_dates', label: 'Due dates' },
  { key: 'bookings', label: 'New bookings' },
  { key: 'schedule_changes', label: 'Schedule changes' },
]

export function NotificationsTab({
  settings,
  onChange,
  onNotificationChange,
}: NotificationsTabProps) {
  return (
    <>
      <SettingsSection
        title="Notification Channels"
        description="Configure how you receive notifications"
      >
        {CHANNELS.map((channel) => {
          const config = settings.notifications[channel.id]
          return (
            <div
              key={channel.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <channel.icon className="h-4 w-4 text-[var(--muted)]" />
                  <div>
                    <div className="text-sm font-medium text-[var(--fg)]">
                      {channel.label}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {channel.description}
                    </div>
                  </div>
                </div>
                <SettingsToggle
                  checked={config.enabled}
                  onChange={(v) =>
                    onNotificationChange(channel.id, 'enabled', v)
                  }
                  label={`Enable ${channel.label}`}
                />
              </div>

              {config.enabled && (
                <div className="ml-6 space-y-2 border-l border-[var(--border)] pl-4">
                  {EVENT_TYPES.map((type) => (
                    <div
                      key={type.key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-[var(--muted)]">
                        {type.label}
                      </span>
                      <SettingsToggle
                        checked={
                          config[type.key as keyof typeof config] as boolean
                        }
                        onChange={(v) =>
                          onNotificationChange(channel.id, type.key, v)
                        }
                        label={`${type.label} via ${channel.label}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </SettingsSection>

      <SettingsSection
        title="Telegram Integration"
        description="Connect a Telegram bot for notifications"
      >
        <Input
          label="Bot Token"
          placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          value={settings.telegram_bot_token || ''}
          onChange={(e) =>
            onChange({ telegram_bot_token: e.target.value || null })
          }
        />
        <Input
          label="Chat ID"
          placeholder="Your Telegram chat ID"
          value={settings.telegram_chat_id || ''}
          onChange={(e) =>
            onChange({ telegram_chat_id: e.target.value || null })
          }
        />
      </SettingsSection>
    </>
  )
}
