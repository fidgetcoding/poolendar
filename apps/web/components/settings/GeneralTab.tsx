'use client'

import type { UserSettings } from '@poolendar/types'
import {
  SettingsSection,
  SettingsRow,
  SettingsSelect,
  SettingsToggle,
} from './SettingsSection'

interface GeneralTabProps {
  settings: UserSettings
  onChange: (partial: Partial<UserSettings>) => void
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  return (
    <>
      <SettingsSection title="Calendar Defaults">
        <SettingsRow label="Default view">
          <SettingsSelect
            value={settings.initial_view}
            onChange={(v) => onChange({ initial_view: v as UserSettings['initial_view'] })}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Week starts on">
          <SettingsSelect
            value={settings.first_day_of_week}
            onChange={(v) =>
              onChange({ first_day_of_week: v as 'sunday' | 'monday' })
            }
            options={[
              { value: 'sunday', label: 'Sunday' },
              { value: 'monday', label: 'Monday' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Time format">
          <SettingsSelect
            value={settings.time_format}
            onChange={(v) => onChange({ time_format: v as '12h' | '24h' })}
            options={[
              { value: '12h', label: '12-hour' },
              { value: '24h', label: '24-hour' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Timezone">
          <SettingsSelect
            value={settings.timezone}
            onChange={(v) => onChange({ timezone: v })}
            options={[
              { value: 'America/New_York', label: 'Eastern (ET)' },
              { value: 'America/Chicago', label: 'Central (CT)' },
              { value: 'America/Denver', label: 'Mountain (MT)' },
              { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
              { value: 'UTC', label: 'UTC' },
              { value: 'Europe/London', label: 'London (GMT/BST)' },
              { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
              { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Durations & Reminders">
        <SettingsRow label="Default event duration">
          <SettingsSelect
            value="30"
            onChange={() => {}}
            options={[
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
              { value: '45', label: '45 min' },
              { value: '60', label: '60 min' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Default task duration">
          <SettingsSelect
            value={String(settings.default_task_duration_minutes)}
            onChange={(v) =>
              onChange({ default_task_duration_minutes: parseInt(v, 10) })
            }
            options={[
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
              { value: '45', label: '45 min' },
              { value: '60', label: '60 min' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Undo grace period">
          <SettingsSelect
            value={String(settings.undo_grace_period_seconds)}
            onChange={(v) =>
              onChange({ undo_grace_period_seconds: parseInt(v, 10) })
            }
            options={[
              { value: '5', label: '5 sec' },
              { value: '10', label: '10 sec' },
              { value: '15', label: '15 sec' },
              { value: '30', label: '30 sec' },
              { value: '60', label: '60 sec' },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Time Grid">
        <SettingsRow label="Display resolution">
          <SettingsSelect
            value={String(settings.time_display_resolution)}
            onChange={(v) =>
              onChange({ time_display_resolution: parseInt(v, 10) })
            }
            options={[
              { value: '5', label: '5 min' },
              { value: '10', label: '10 min' },
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
              { value: '60', label: '60 min' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Drag resolution">
          <SettingsSelect
            value={String(settings.time_drag_resolution)}
            onChange={(v) =>
              onChange({ time_drag_resolution: parseInt(v, 10) })
            }
            options={[
              { value: '5', label: '5 min' },
              { value: '10', label: '10 min' },
              { value: '15', label: '15 min' },
              { value: '30', label: '30 min' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Background density">
          <SettingsSelect
            value={settings.background_density}
            onChange={(v) =>
              onChange({
                background_density: v as UserSettings['background_density'],
              })
            }
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Display">
        <SettingsRow label="Show weekends">
          <SettingsToggle
            checked={settings.show_weekends}
            onChange={(v) => onChange({ show_weekends: v })}
          />
        </SettingsRow>
        <SettingsRow label="Widen current day">
          <SettingsToggle
            checked={settings.widen_current_day}
            onChange={(v) => onChange({ widen_current_day: v })}
          />
        </SettingsRow>
        <SettingsRow label="Dim past events">
          <SettingsToggle
            checked={settings.dim_past_events}
            onChange={(v) => onChange({ dim_past_events: v })}
          />
        </SettingsRow>
        <SettingsRow label="Show completed tasks">
          <SettingsToggle
            checked={settings.show_completed_tasks}
            onChange={(v) => onChange({ show_completed_tasks: v })}
          />
        </SettingsRow>
        <SettingsRow label="Show declined events">
          <SettingsToggle
            checked={settings.show_declined_events}
            onChange={(v) => onChange({ show_declined_events: v })}
          />
        </SettingsRow>
        <SettingsRow label="Merge duplicate events">
          <SettingsToggle
            checked={settings.merge_duplicate_events}
            onChange={(v) => onChange({ merge_duplicate_events: v })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Theme">
        <SettingsRow label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.theme_accent_color}
              onChange={(e) =>
                onChange({ theme_accent_color: e.target.value })
              }
              className="h-8 w-8 cursor-pointer rounded border border-[var(--border)] bg-transparent"
            />
            <span className="text-xs font-mono text-[var(--muted)]">
              {settings.theme_accent_color}
            </span>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Task Defaults">
        <SettingsRow label="Privacy default">
          <SettingsSelect
            value={settings.privacy_default}
            onChange={(v) =>
              onChange({ privacy_default: v as 'private' | 'public' })
            }
            options={[
              { value: 'private', label: 'Private' },
              { value: 'public', label: 'Public' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Busy/Free default">
          <SettingsSelect
            value={settings.busy_free_default}
            onChange={(v) =>
              onChange({ busy_free_default: v as 'busy' | 'free' })
            }
            options={[
              { value: 'busy', label: 'Busy' },
              { value: 'free', label: 'Free' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Move task due date">
          <SettingsSelect
            value={settings.move_due_date_behavior}
            onChange={(v) =>
              onChange({
                move_due_date_behavior: v as 'ask' | 'always' | 'never',
              })
            }
            options={[
              { value: 'ask', label: 'Ask' },
              { value: 'always', label: 'Always' },
              { value: 'never', label: 'Never' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Auto-assign due dates">
          <SettingsToggle
            checked={settings.auto_assign_due_dates}
            onChange={(v) => onChange({ auto_assign_due_dates: v })}
          />
        </SettingsRow>
      </SettingsSection>
    </>
  )
}
