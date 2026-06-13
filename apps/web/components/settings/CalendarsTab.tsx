'use client'

import { useState } from 'react'
import { Mail, RefreshCw, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SettingsSection, SettingsToggle } from './SettingsSection'
import type { GoogleAccount, Calendar as CalendarType } from '@poolendar/types'

interface CalendarsTabProps {
  googleAccounts: GoogleAccount[]
  calendars: CalendarType[]
  onConnect: () => void
  onDisconnect: (id: string) => void
  onToggleCalendar: (id: string, active: boolean) => void
}

export function CalendarsTab({
  googleAccounts,
  calendars,
  onConnect,
  onDisconnect,
  onToggleCalendar,
}: CalendarsTabProps) {
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)

  return (
    <>
      <SettingsSection
        title="Connected Accounts"
        description="Connect Google accounts to sync calendars"
      >
        {googleAccounts.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            No Google accounts connected.
          </p>
        )}

        {googleAccounts.map((account) => {
          const accountCalendars = calendars.filter(
            (c) => c.google_account_id === account.id
          )

          return (
            <div
              key={account.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg)]"
            >
              {/* Account header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[var(--muted)]" />
                  <div>
                    <div className="text-sm font-medium text-[var(--fg)]">
                      {account.email}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {account.last_synced_at
                        ? `Last synced ${new Date(account.last_synced_at).toLocaleString()}`
                        : 'Never synced'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                    aria-label="Resync account"
                    title="Resync"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  {disconnectingId === account.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          onDisconnect(account.id)
                          setDisconnectingId(null)
                        }}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDisconnectingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDisconnectingId(account.id)}
                      className="rounded p-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--destructive)]"
                      aria-label="Disconnect account"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Calendar list */}
              <div className="divide-y divide-[var(--border)]">
                {accountCalendars.map((cal) => (
                  <div
                    key={cal.id}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: cal.color }}
                      />
                      <span className="text-sm text-[var(--fg)]">
                        {cal.name}
                      </span>
                      {cal.is_primary && (
                        <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                          Primary
                        </span>
                      )}
                    </div>
                    <SettingsToggle
                      checked={cal.is_active}
                      onChange={(active) => onToggleCalendar(cal.id, active)}
                      label={`Toggle ${cal.name}`}
                    />
                  </div>
                ))}
                {accountCalendars.length === 0 && (
                  <div className="px-4 py-3 text-xs text-[var(--muted)]">
                    No calendars found. Try resyncing.
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <Button onClick={onConnect} variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          Connect Google Account
        </Button>
      </SettingsSection>
    </>
  )
}
