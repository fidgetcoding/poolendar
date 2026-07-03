'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { SettingsToggle } from './SettingsSection'
import { AvailabilityGridEditor } from './AvailabilityGridEditor'
import type { AvailabilityRange } from '@/lib/booking/ranges'

export interface EditableBookingLink {
  id: string
  slug: string
  name: string
  duration_minutes: number
  is_public: boolean
  requires_approval: boolean
  buffer_minutes: number
  minimum_notice_hours: number
  conferencing: boolean
  availability: AvailabilityRange[]
}

// Per-link editor exposed under a booking page row (spec #53/#54): the
// drag-to-paint availability grid plus buffer, minimum-notice, approval and
// conferencing controls. Saves via PATCH /api/booking-links/:id.
export function BookingLinkEditor({
  link,
  onSaved,
}: {
  link: EditableBookingLink
  onSaved: (updated: EditableBookingLink) => void
}) {
  const [availability, setAvailability] = useState<AvailabilityRange[]>(
    Array.isArray(link.availability) ? link.availability : []
  )
  const [duration, setDuration] = useState(link.duration_minutes)
  const [buffer, setBuffer] = useState(link.buffer_minutes ?? 0)
  const [minNotice, setMinNotice] = useState(link.minimum_notice_hours ?? 0)
  const [requiresApproval, setRequiresApproval] = useState(!!link.requires_approval)
  const [conferencing, setConferencing] = useState(!!link.conferencing)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (availability.length === 0) {
      toast.error('Paint at least one available block before saving.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/booking-links/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability,
          duration_minutes: duration,
          buffer_minutes: buffer,
          minimum_notice_hours: minNotice,
          requires_approval: requiresApproval,
          conferencing,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to save availability')
        return
      }
      const updated = await res.json()
      onSaved(updated)
      toast.success('Booking page saved')
    } catch {
      toast.error('Failed to save availability')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 space-y-4 border-t border-[var(--border)] pt-4">
      <AvailabilityGridEditor value={availability} onChange={setAvailability} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField
          label="Duration (min)"
          value={duration}
          min={5}
          step={5}
          onChange={setDuration}
        />
        <NumberField
          label="Buffer (min)"
          value={buffer}
          min={0}
          step={5}
          onChange={setBuffer}
        />
        <NumberField
          label="Min notice (hrs)"
          value={minNotice}
          min={0}
          step={1}
          onChange={setMinNotice}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--fg)]">Requires approval</div>
          <div className="text-xs text-[var(--muted)]">
            Bookings stay pending until you approve them.
          </div>
        </div>
        <SettingsToggle
          checked={requiresApproval}
          onChange={setRequiresApproval}
          label="Toggle requires approval"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-[var(--fg)]">Google Meet</div>
          <div className="text-xs text-[var(--muted)]">
            Auto-generate a conferencing link on confirmed bookings.
          </div>
        </div>
        <SettingsToggle
          checked={conferencing}
          onChange={setConferencing}
          label="Toggle conferencing"
        />
      </div>

      <Button onClick={save} disabled={saving} size="sm">
        {saving ? 'Saving…' : 'Save booking page'}
      </Button>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  )
}
