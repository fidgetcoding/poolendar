'use client'

import { Send } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { SettingsSection } from './SettingsSection'
import type { UserSettings } from '@poolendar/types'

interface TelegramTabProps {
  settings: UserSettings
  onChange: (partial: Partial<UserSettings>) => void
}

export function TelegramTab({ settings, onChange }: TelegramTabProps) {
  return (
    <>
      <SettingsSection
        title="Telegram Integration"
        description="Connect a Telegram bot to receive notifications directly in Telegram"
      >
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Send className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-sm font-medium text-[var(--fg)]">
              Setup Instructions
            </span>
          </div>
          <ol className="space-y-1.5 text-xs text-[var(--muted)] list-decimal list-inside">
            <li>
              Open Telegram and message{' '}
              <span className="text-[var(--accent)]">@BotFather</span>
            </li>
            <li>
              Send <code className="rounded bg-[var(--surface)] px-1">/newbot</code>{' '}
              and follow the prompts to create a bot
            </li>
            <li>Copy the bot token and paste it below</li>
            <li>
              Start a chat with your bot, then send{' '}
              <code className="rounded bg-[var(--surface)] px-1">/start</code>
            </li>
            <li>Enter your Chat ID below to receive notifications</li>
          </ol>
        </div>

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
