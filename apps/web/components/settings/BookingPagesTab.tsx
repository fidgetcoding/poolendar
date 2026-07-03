'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ExternalLink, Copy, Check, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SettingsSection, SettingsToggle } from './SettingsSection'
import { BookingLinkEditor, type EditableBookingLink } from './BookingLinkEditor'
import type { AvailabilityRange } from '@/lib/booking/ranges'
import { toast } from 'sonner'

type BookingLink = EditableBookingLink & { created_at: string }

// A sensible starting availability so a freshly created link is immediately
// valid (spec requires availability to be a non-empty array — NOT `{}`, the old
// bug that made every UI-created link fail validation). The user refines it in
// the per-link editor.
const DEFAULT_AVAILABILITY: AvailabilityRange[] = [
  { day: 'monday', start: '09:00', end: '17:00' },
  { day: 'tuesday', start: '09:00', end: '17:00' },
  { day: 'wednesday', start: '09:00', end: '17:00' },
  { day: 'thursday', start: '09:00', end: '17:00' },
  { day: 'friday', start: '09:00', end: '17:00' },
]

export function BookingPagesTab() {
  const [links, setLinks] = useState<BookingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [newDuration, setNewDuration] = useState(30)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadLinks()
  }, [])

  async function loadLinks() {
    try {
      const res = await fetch('/api/booking-links')
      if (res.ok) {
        const data = await res.json()
        setLinks(Array.isArray(data) ? data : (data?.items ?? []))
      }
    } catch {
      toast.error('Failed to load booking pages')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/booking-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          duration_minutes: newDuration,
          is_public: true,
          requires_approval: false,
          buffer_minutes: 0,
          minimum_notice_hours: 1,
          // Always the array shape; conferencing is a boolean, never the string 'none'.
          availability: DEFAULT_AVAILABILITY,
          conferencing: false,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to create booking page')
        return
      }
      const link = await res.json()
      setLinks((l) => [link, ...l])
      setNewName('')
      setNewSlug('')
      setNewDuration(30)
      setEditingId(link.id) // open the editor so they can paint real availability
      toast.success('Booking page created')
    } catch {
      toast.error('Failed to create booking page')
    } finally {
      setCreating(false)
    }
  }

  async function handleTogglePublic(id: string, isPublic: boolean) {
    try {
      const res = await fetch(`/api/booking-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: isPublic }),
      })
      if (!res.ok) {
        toast.error('Failed to update booking page')
        return
      }
      setLinks((l) => l.map((link) => (link.id === id ? { ...link, is_public: isPublic } : link)))
    } catch {
      toast.error('Failed to update booking page')
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/booking-links/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete booking page')
        return
      }
      setLinks((l) => l.filter((link) => link.id !== id))
      setDeletingId(null)
      toast.success('Booking page deleted')
    } catch {
      toast.error('Failed to delete booking page')
    }
  }

  function copyUrl(slug: string, id: string) {
    const url = `${window.location.origin}/book/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('Link copied')
  }

  if (loading) {
    return (
      <SettingsSection title="Booking Pages">
        <p className="text-sm text-[var(--muted)]">Loading booking pages...</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Booking Pages"
      description="Create and manage shareable booking links"
    >
      {links.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No booking pages yet.</p>
      )}

      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--fg)]">{link.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">/{link.slug}</span>
                  <span className="text-xs text-[var(--muted)]">{link.duration_minutes} min</span>
                  {link.requires_approval && (
                    <span className="text-xs text-[var(--accent)]">approval</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SettingsToggle
                  checked={link.is_public}
                  onChange={(v) => handleTogglePublic(link.id, v)}
                  label={`Toggle ${link.name} visibility`}
                />
                <button
                  onClick={() => setEditingId((id) => (id === link.id ? null : link.id))}
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  aria-label={`Edit ${link.name} availability`}
                  aria-expanded={editingId === link.id}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button
                  onClick={() => copyUrl(link.slug, link.id)}
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  aria-label="Copy booking link"
                >
                  {copiedId === link.id ? (
                    <Check className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <a
                  href={`/book/${link.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                  aria-label="Open booking page"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                {deletingId === link.id ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(link.id)}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(link.id)}
                    className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--destructive)]"
                    aria-label={`Delete ${link.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {editingId === link.id && (
              <BookingLinkEditor
                link={link}
                onSaved={(updated) =>
                  setLinks((l) => l.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Create new booking page */}
      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4">
        <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
          New Booking Page
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Name"
              placeholder="e.g. Quick Chat"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (!newSlug || newSlug === slugify(newName)) {
                  setNewSlug(slugify(e.target.value))
                }
              }}
            />
          </div>
          <div className="w-36">
            <Input
              label="Slug"
              placeholder="quick-chat"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">Duration</label>
            <select
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
            </select>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newSlug.trim()} size="sm">
          <Plus className="h-4 w-4" />
          Create Booking Page
        </Button>
      </div>
    </SettingsSection>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
