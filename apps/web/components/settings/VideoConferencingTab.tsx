'use client'

import { Video } from 'lucide-react'
import { SettingsSection } from './SettingsSection'

const PROVIDERS = [
  { name: 'Zoom', description: 'Auto-create Zoom meetings for bookings' },
  { name: 'Google Meet', description: 'Use Google Meet for calendar events' },
  { name: 'Microsoft Teams', description: 'Connect Microsoft Teams meetings' },
]

export function VideoConferencingTab() {
  return (
    <SettingsSection
      title="Video Conferencing"
      description="Connect video conferencing providers for automatic meeting links"
    >
      <div className="space-y-2">
        {PROVIDERS.map((provider) => (
          <div
            key={provider.name}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Video className="h-4 w-4 text-[var(--muted)]" />
              <div>
                <div className="text-sm font-medium text-[var(--fg)]">
                  {provider.name}
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {provider.description}
                </div>
              </div>
            </div>
            <button
              disabled
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] cursor-not-allowed"
            >
              Coming Soon
            </button>
          </div>
        ))}
      </div>
    </SettingsSection>
  )
}
