'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Globe, Calendar, Bell, Key, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { GeneralTab } from './GeneralTab'
import { CalendarsTab } from './CalendarsTab'
import { NotificationsTab } from './NotificationsTab'
import { AccountTab } from './AccountTab'
import { ApiKeyManager } from './ApiKeyManager'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type {
  Profile,
  UserSettings,
  NotificationSettings,
  ApiKey,
  GoogleAccount,
  Calendar as CalendarType,
} from '@poolendar/types'

type SettingsTab =
  | 'general'
  | 'calendars'
  | 'notifications'
  | 'api-keys'
  | 'account'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile | null
  onProfileUpdate: (profile: Profile) => void
}

const DEFAULT_SETTINGS: UserSettings = {
  default_event_calendar_id: null,
  default_task_calendar_id: null,
  privacy_default: 'private',
  busy_free_default: 'busy',
  move_due_date_behavior: 'ask',
  auto_assign_due_dates: false,
  timezone: 'America/New_York',
  time_format: '12h',
  language: 'en',
  first_day_of_week: 'sunday',
  initial_view: 'week',
  theme_accent_color: '#f9a825',
  time_grid_start: '00:00',
  time_grid_end: '24:00',
  time_display_resolution: 15,
  time_drag_resolution: 15,
  default_task_duration_minutes: 30,
  limit_events_per_day: 4,
  undo_grace_period_seconds: 30,
  show_weekends: true,
  widen_current_day: true,
  dim_past_events: true,
  show_completed_tasks: true,
  show_declined_events: false,
  merge_duplicate_events: true,
  background_density: 'comfortable',
  notifications: {
    browser_push: { enabled: true, reminders: true, due_dates: true, bookings: true, schedule_changes: true },
    email: { enabled: false, reminders: false, due_dates: false, bookings: false, schedule_changes: false },
    in_app: { enabled: true, reminders: true, due_dates: true, bookings: true, schedule_changes: true },
    telegram: { enabled: false, reminders: false, due_dates: false, bookings: false, schedule_changes: false },
  },
  telegram_bot_token: null,
  telegram_chat_id: null,
  booking_page_title: null,
  booking_page_welcome: null,
  booking_page_brand_color: null,
  booking_page_logo_url: null,
  booking_page_show_poolendar_branding: true,
}

const TABS: { id: SettingsTab; label: string; icon: typeof Globe }[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'calendars', label: 'Calendars', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'account', label: 'Account', icon: User },
]

export function SettingsModal({
  open,
  onOpenChange,
  profile,
  onProfileUpdate,
}: SettingsModalProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([])
  const [calendars, setCalendars] = useState<CalendarType[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [saving, setSaving] = useState(false)

  // Profile editing state
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [company, setCompany] = useState('')

  // Load settings when modal opens
  useEffect(() => {
    if (!open || !profile) return

    setSettings({ ...DEFAULT_SETTINGS, ...profile.settings })
    setDisplayName(profile.display_name || '')
    setUsername(profile.username || '')
    setCompany(profile.company || '')

    loadGoogleAccounts()
    loadCalendars()
    loadApiKeys()
  }, [open, profile])

  async function loadGoogleAccounts() {
    const { data } = await supabase
      .from('google_accounts')
      .select('id, user_id, email, token_expires_at, sync_token, last_synced_at, created_at')
      .order('created_at', { ascending: true })
    if (data) setGoogleAccounts(data)
  }

  async function loadCalendars() {
    const { data } = await supabase
      .from('calendars')
      .select('*')
      .order('name', { ascending: true })
    if (data) setCalendars(data)
  }

  async function loadApiKeys() {
    const { data } = await supabase
      .from('api_keys')
      .select('id, user_id, name, key_prefix, last_used_at, created_at')
      .order('created_at', { ascending: false })
    if (data) setApiKeys(data)
  }

  function updateSettings(partial: Partial<UserSettings>) {
    setSettings((s) => ({ ...s, ...partial }))
  }

  function updateNotifications(
    channel: keyof NotificationSettings,
    key: string,
    value: boolean
  ) {
    setSettings((s) => ({
      ...s,
      notifications: {
        ...s.notifications,
        [channel]: {
          ...s.notifications[channel],
          [key]: value,
        },
      },
    }))
  }

  const saveSettings = useCallback(async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          settings,
          display_name: displayName || null,
          username,
          company: company || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (error) {
        toast.error('Failed to save settings')
        return
      }

      onProfileUpdate({
        ...profile,
        settings,
        display_name: displayName || null,
        username,
        company: company || null,
      })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [profile, settings, displayName, username, company, supabase, onProfileUpdate])

  async function handleConnectGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
        scopes:
          'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      },
    })
    if (error) {
      toast.error('Failed to connect Google account')
    }
  }

  async function handleDisconnectAccount(accountId: string) {
    const { error } = await supabase
      .from('google_accounts')
      .delete()
      .eq('id', accountId)

    if (error) {
      toast.error('Failed to disconnect account')
      return
    }

    setGoogleAccounts((a) => a.filter((acc) => acc.id !== accountId))
    setCalendars((c) => c.filter((cal) => cal.google_account_id !== accountId))
    toast.success('Account disconnected')
  }

  async function toggleCalendar(calendarId: string, isActive: boolean) {
    const { error } = await supabase
      .from('calendars')
      .update({ is_active: isActive })
      .eq('id', calendarId)

    if (error) {
      toast.error('Failed to update calendar')
      return
    }

    setCalendars((c) =>
      c.map((cal) =>
        cal.id === calendarId ? { ...cal, is_active: isActive } : cal
      )
    )
  }

  async function handleDeleteAccount() {
    if (!profile) return

    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    )
    if (!confirmed) return

    const doubleConfirmed = window.confirm(
      'This will permanently delete all your data, including events, tasks, bookings, and API keys. Continue?'
    )
    if (!doubleConfirmed) return

    try {
      const { error } = await supabase.auth.admin.deleteUser(profile.id)
      if (error) {
        toast.error('Failed to delete account. Contact support.')
        return
      }

      await supabase.auth.signOut()
      window.location.href = '/login'
    } catch {
      toast.error('Failed to delete account')
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative flex h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        {/* Left sidebar nav */}
        <div className="flex w-48 flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg)] p-3">
          <h2 className="mb-4 px-3 text-sm font-semibold text-[var(--fg)]">
            Settings
          </h2>
          <nav className="flex flex-col gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--surface)] text-[var(--fg)] font-medium'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
            <h3 className="text-sm font-semibold text-[var(--fg)]">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-8">
              {activeTab === 'general' && (
                <GeneralTab settings={settings} onChange={updateSettings} />
              )}
              {activeTab === 'calendars' && (
                <CalendarsTab
                  googleAccounts={googleAccounts}
                  calendars={calendars}
                  onConnect={handleConnectGoogle}
                  onDisconnect={handleDisconnectAccount}
                  onToggleCalendar={toggleCalendar}
                />
              )}
              {activeTab === 'notifications' && (
                <NotificationsTab
                  settings={settings}
                  onChange={updateSettings}
                  onNotificationChange={updateNotifications}
                />
              )}
              {activeTab === 'api-keys' && (
                <ApiKeyManager
                  apiKeys={apiKeys}
                  onKeysChange={setApiKeys}
                />
              )}
              {activeTab === 'account' && (
                <AccountTab
                  profile={profile}
                  displayName={displayName}
                  username={username}
                  company={company}
                  onDisplayNameChange={setDisplayName}
                  onUsernameChange={setUsername}
                  onCompanyChange={setCompany}
                  onDeleteAccount={handleDeleteAccount}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
