'use client'

import { User, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsSection } from './SettingsSection'
import type { Profile } from '@poolendar/types'

interface AccountTabProps {
  profile: Profile | null
  displayName: string
  username: string
  company: string
  onDisplayNameChange: (v: string) => void
  onUsernameChange: (v: string) => void
  onCompanyChange: (v: string) => void
  onDeleteAccount: () => void
}

export function AccountTab({
  profile,
  displayName,
  username,
  company,
  onDisplayNameChange,
  onUsernameChange,
  onCompanyChange,
  onDeleteAccount,
}: AccountTabProps) {
  return (
    <>
      <SettingsSection title="Profile">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)] text-2xl">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-[var(--muted)]" />
            )}
          </div>
          <div>
            <p className="text-sm text-[var(--fg)]">
              {profile?.display_name || 'No name set'}
            </p>
            <p className="text-xs text-[var(--muted)]">
              Change your avatar via Google account settings
            </p>
          </div>
        </div>

        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Your name"
        />
        <Input
          label="Username"
          value={username}
          onChange={(e) =>
            onUsernameChange(
              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
            )
          }
          placeholder="username"
        />
        <p className="text-xs text-[var(--muted)]">
          Your booking page URL:{' '}
          <span className="text-[var(--accent)]">
            {username || 'username'}.poolendar.com
          </span>
        </p>
        <Input
          label="Company"
          value={company}
          onChange={(e) => onCompanyChange(e.target.value)}
          placeholder="Your company (optional)"
        />
      </SettingsSection>

      <SettingsSection title="Danger Zone">
        <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--destructive)]">
                Delete Account
              </p>
              <p className="text-xs text-[var(--muted)]">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteAccount}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SettingsSection>
    </>
  )
}
