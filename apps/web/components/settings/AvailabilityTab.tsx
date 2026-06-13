'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsSection } from './SettingsSection'
import { toast } from 'sonner'

interface TimeBlock {
  day: number
  start: string
  end: string
}

interface Schedule {
  id: string
  name: string
  time_blocks: TimeBlock[]
  created_at: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function AvailabilityTab() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadSchedules()
  }, [])

  async function loadSchedules() {
    try {
      const res = await fetch('/api/schedules')
      if (res.ok) {
        const data = await res.json()
        setSchedules(data)
      }
    } catch {
      toast.error('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const defaultBlocks: TimeBlock[] = [1, 2, 3, 4, 5].map((day) => ({
        day,
        start: '09:00',
        end: '17:00',
      }))

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), time_blocks: defaultBlocks }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'Failed to create schedule')
        return
      }
      const schedule = await res.json()
      setSchedules((s) => [schedule, ...s])
      setNewName('')
      toast.success('Schedule created')
    } catch {
      toast.error('Failed to create schedule')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete schedule')
        return
      }
      setSchedules((s) => s.filter((sched) => sched.id !== id))
      setDeletingId(null)
      toast.success('Schedule deleted')
    } catch {
      toast.error('Failed to delete schedule')
    }
  }

  if (loading) {
    return (
      <SettingsSection title="Availability">
        <p className="text-sm text-[var(--muted)]">Loading schedules...</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Availability Schedules"
      description="Define when you are available for bookings"
    >
      {schedules.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No schedules yet. Create one to get started.</p>
      )}

      <div className="space-y-3">
        {schedules.map((schedule) => (
          <div
            key={schedule.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-[var(--muted)]" />
                <span className="text-sm font-medium text-[var(--fg)]">
                  {schedule.name}
                </span>
              </div>
              {deletingId === schedule.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setDeletingId(schedule.id)}
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--destructive)]"
                  aria-label={`Delete ${schedule.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="divide-y divide-[var(--border)]">
              {schedule.time_blocks.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[var(--muted)]">
                  No time blocks configured.
                </div>
              ) : (
                schedule.time_blocks.map((block, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <span className="text-sm text-[var(--fg)] w-12">
                      {DAY_LABELS[block.day]}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      {block.start} - {block.end}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create new schedule */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            placeholder="Schedule name (e.g. Working Hours)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          size="default"
        >
          <Plus className="h-4 w-4" />
          Add Schedule
        </Button>
      </div>
    </SettingsSection>
  )
}
