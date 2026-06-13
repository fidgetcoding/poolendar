'use client'

import * as React from 'react'
import { Repeat2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RecurrenceBuilderProps {
  value: string | null
  onChange: (rrule: string | null) => void
}

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
type EndType = 'never' | 'count' | 'until'

const PRESET_OPTIONS = [
  { label: 'None', value: null },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekdays', value: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly', value: 'FREQ=YEARLY' },
] as const

const FREQUENCY_LABELS: Record<Frequency, { singular: string; plural: string }> = {
  DAILY: { singular: 'day', plural: 'days' },
  WEEKLY: { singular: 'week', plural: 'weeks' },
  MONTHLY: { singular: 'month', plural: 'months' },
  YEARLY: { singular: 'year', plural: 'years' },
}

const DAYS_OF_WEEK = [
  { short: 'S', code: 'SU' },
  { short: 'M', code: 'MO' },
  { short: 'T', code: 'TU' },
  { short: 'W', code: 'WE' },
  { short: 'T', code: 'TH' },
  { short: 'F', code: 'FR' },
  { short: 'S', code: 'SA' },
] as const

function parseRRule(rrule: string | null): {
  frequency: Frequency
  interval: number
  byDay: string[]
  endType: EndType
  count: number
  until: string
} {
  const defaults = {
    frequency: 'WEEKLY' as Frequency,
    interval: 1,
    byDay: [] as string[],
    endType: 'never' as EndType,
    count: 10,
    until: '',
  }

  if (!rrule) return defaults

  const parts = rrule.split(';')
  const result = { ...defaults }

  for (const part of parts) {
    const [key, val] = part.split('=')
    switch (key) {
      case 'FREQ':
        if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(val)) {
          result.frequency = val as Frequency
        }
        break
      case 'INTERVAL':
        result.interval = parseInt(val, 10) || 1
        break
      case 'BYDAY':
        result.byDay = val.split(',')
        break
      case 'COUNT':
        result.endType = 'count'
        result.count = parseInt(val, 10) || 10
        break
      case 'UNTIL':
        result.endType = 'until'
        result.until = val
        break
    }
  }

  return result
}

function buildRRule(config: {
  frequency: Frequency
  interval: number
  byDay: string[]
  endType: EndType
  count: number
  until: string
}): string {
  const parts: string[] = [`FREQ=${config.frequency}`]

  if (config.interval > 1) {
    parts.push(`INTERVAL=${config.interval}`)
  }

  if (config.frequency === 'WEEKLY' && config.byDay.length > 0) {
    parts.push(`BYDAY=${config.byDay.join(',')}`)
  }

  if (config.endType === 'count' && config.count > 0) {
    parts.push(`COUNT=${config.count}`)
  } else if (config.endType === 'until' && config.until) {
    parts.push(`UNTIL=${config.until}`)
  }

  return parts.join(';')
}

function isPresetMatch(value: string | null, preset: string | null): boolean {
  if (value === null && preset === null) return true
  if (value === null || preset === null) return false
  return value === preset
}

export function RecurrenceBuilder({ value, onChange }: RecurrenceBuilderProps) {
  const [isCustom, setIsCustom] = React.useState(false)
  const parsed = parseRRule(value)

  const [frequency, setFrequency] = React.useState<Frequency>(parsed.frequency)
  const [interval, setInterval] = React.useState(parsed.interval)
  const [byDay, setByDay] = React.useState<string[]>(parsed.byDay)
  const [endType, setEndType] = React.useState<EndType>(parsed.endType)
  const [count, setCount] = React.useState(parsed.count)
  const [until, setUntil] = React.useState(parsed.until)

  const isMatchingPreset = PRESET_OPTIONS.some((p) =>
    isPresetMatch(value, p.value)
  )

  React.useEffect(() => {
    if (value !== null && !isMatchingPreset && !isCustom) {
      setIsCustom(true)
    }
  }, [value, isMatchingPreset, isCustom])

  function emitCustomChange(overrides: Partial<{
    frequency: Frequency
    interval: number
    byDay: string[]
    endType: EndType
    count: number
    until: string
  }>) {
    const config = {
      frequency: overrides.frequency ?? frequency,
      interval: overrides.interval ?? interval,
      byDay: overrides.byDay ?? byDay,
      endType: overrides.endType ?? endType,
      count: overrides.count ?? count,
      until: overrides.until ?? until,
    }
    onChange(buildRRule(config))
  }

  function handlePresetClick(preset: typeof PRESET_OPTIONS[number]) {
    setIsCustom(false)
    onChange(preset.value)
    if (preset.value) {
      const p = parseRRule(preset.value)
      setFrequency(p.frequency)
      setInterval(p.interval)
      setByDay(p.byDay)
      setEndType(p.endType)
      setCount(p.count)
      setUntil(p.until)
    }
  }

  function handleCustomClick() {
    setIsCustom(true)
    emitCustomChange({})
  }

  function handleFrequencyChange(f: Frequency) {
    setFrequency(f)
    if (f !== 'WEEKLY') {
      setByDay([])
      emitCustomChange({ frequency: f, byDay: [] })
    } else {
      emitCustomChange({ frequency: f })
    }
  }

  function handleIntervalChange(val: string) {
    const n = Math.max(1, parseInt(val, 10) || 1)
    setInterval(n)
    emitCustomChange({ interval: n })
  }

  function toggleDay(code: string) {
    const next = byDay.includes(code)
      ? byDay.filter((d) => d !== code)
      : [...byDay, code]
    setByDay(next)
    emitCustomChange({ byDay: next })
  }

  function handleEndTypeChange(et: EndType) {
    setEndType(et)
    emitCustomChange({ endType: et })
  }

  function handleCountChange(val: string) {
    const n = Math.max(1, parseInt(val, 10) || 1)
    setCount(n)
    emitCustomChange({ count: n })
  }

  function handleUntilChange(val: string) {
    setUntil(val)
    emitCustomChange({ until: val.replace(/-/g, '') })
  }

  const freqLabel = FREQUENCY_LABELS[frequency]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <Repeat2 size={14} className="text-[var(--muted)]" />
        <span>Recurrence</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_OPTIONS.map((preset) => {
          const active = !isCustom && isPresetMatch(value, preset.value)
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md',
                'border transition-colors duration-150',
                active
                  ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
                  : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--accent)]'
              )}
            >
              {preset.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={handleCustomClick}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded-md',
            'border transition-colors duration-150',
            isCustom
              ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
              : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--accent)]'
          )}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="space-y-3 pl-1 border-l-2 border-[var(--accent)] ml-1">
          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs text-[var(--muted)] shrink-0">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => handleFrequencyChange(e.target.value as Frequency)}
              className={cn(
                'px-2 py-1 text-sm rounded-md',
                'bg-[var(--bg)] border border-[var(--border)]',
                'text-[var(--fg)]',
                'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]'
              )}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pl-3">
            <label className="text-xs text-[var(--muted)] shrink-0">Every</label>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => handleIntervalChange(e.target.value)}
              className={cn(
                'w-16 px-2 py-1 text-sm rounded-md text-center',
                'bg-[var(--bg)] border border-[var(--border)]',
                'text-[var(--fg)]',
                'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]'
              )}
            />
            <span className="text-xs text-[var(--muted)]">
              {interval === 1 ? freqLabel.singular : freqLabel.plural}
            </span>
          </div>

          {frequency === 'WEEKLY' && (
            <div className="pl-3 space-y-1.5">
              <label className="text-xs text-[var(--muted)]">On days</label>
              <div className="flex items-center gap-1">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const active = byDay.includes(day.code)
                  return (
                    <button
                      key={`${day.code}-${idx}`}
                      type="button"
                      onClick={() => toggleDay(day.code)}
                      className={cn(
                        'w-8 h-8 text-xs font-medium rounded-md',
                        'border transition-colors duration-150',
                        active
                          ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
                          : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--fg)] hover:border-[var(--accent)]'
                      )}
                    >
                      {day.short}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="pl-3 space-y-2">
            <label className="text-xs text-[var(--muted)]">Ends</label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recurrence-end"
                checked={endType === 'never'}
                onChange={() => handleEndTypeChange('never')}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--fg)]">Never</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recurrence-end"
                checked={endType === 'count'}
                onChange={() => handleEndTypeChange('count')}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--fg)]">After</span>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) => handleCountChange(e.target.value)}
                disabled={endType !== 'count'}
                className={cn(
                  'w-16 px-2 py-1 text-sm rounded-md text-center',
                  'bg-[var(--bg)] border border-[var(--border)]',
                  'text-[var(--fg)]',
                  'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                  'disabled:opacity-40'
                )}
              />
              <span className="text-sm text-[var(--muted)]">occurrences</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="recurrence-end"
                checked={endType === 'until'}
                onChange={() => handleEndTypeChange('until')}
                className="accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--fg)]">Until</span>
              <input
                type="date"
                value={
                  until && until.length === 8
                    ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
                    : until
                }
                onChange={(e) => handleUntilChange(e.target.value)}
                disabled={endType !== 'until'}
                className={cn(
                  'px-2 py-1 text-sm rounded-md',
                  'bg-[var(--bg)] border border-[var(--border)]',
                  'text-[var(--fg)]',
                  'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                  'disabled:opacity-40'
                )}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
