'use client'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function SettingsSection({
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--fg)]">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

interface SettingsRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1">
        <div className="text-sm text-[var(--fg)]">{label}</div>
        {description && (
          <div className="text-xs text-[var(--muted)]">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

interface SettingsSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

export function SettingsSelect({
  value,
  onChange,
  options,
}: SettingsSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface SettingsToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function SettingsToggle({ checked, onChange, label }: SettingsToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
