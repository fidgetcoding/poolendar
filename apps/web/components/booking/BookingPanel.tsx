'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Copy, Check, Globe, Lock, CalendarClock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BookingLink } from '@poolendar/types'

// ---------------------------------------------------------------------------
// Booking panel (#51–52, #57a). A left-drawer list of the user's booking links
// with a copy-public-URL action, plus a Pending Approvals queue at the top where
// the host approves/declines requires_approval bookings.
// ---------------------------------------------------------------------------

interface PendingBooking {
  id: string
  booker_name: string
  booker_email: string
  start_time: string
  booking_links: { name: string; slug: string } | { name: string; slug: string }[]
}

function bookingUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/book/${slug}`
}

function linkName(b: PendingBooking): string {
  const l = Array.isArray(b.booking_links) ? b.booking_links[0] : b.booking_links
  return l?.name ?? 'Booking'
}

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

function LinkRow({ link }: { link: BookingLink }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl(link.slug))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard denied — leave the button state unchanged.
    }
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded hover:bg-[var(--surface-hover)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-[var(--fg)]">{link.name}</span>
          {link.is_public ? (
            <Globe size={11} className="shrink-0 text-[var(--muted)]" aria-label="Public" />
          ) : (
            <Lock size={11} className="shrink-0 text-[var(--muted)]" aria-label="Private" />
          )}
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          {link.duration_minutes} min · /book/{link.slug}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy public link"
        title="Copy public link"
        className="shrink-0 flex items-center justify-center w-6 h-6 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
      >
        {copied ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
      </button>
    </div>
  )
}

function PendingApprovals() {
  const queryClient = useQueryClient()
  const { data: pending = [] } = useQuery({
    queryKey: ['booking-pending'],
    queryFn: async (): Promise<PendingBooking[]> => {
      const res = await fetch('/api/booking/bookings?status=pending')
      if (!res.ok) throw new Error(`Failed to load pending bookings (${res.status})`)
      const data = await res.json()
      return (Array.isArray(data) ? data : (data?.items ?? [])) as PendingBooking[]
    },
  })

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'decline' }) => {
      const res = await fetch(`/api/booking/bookings/${id}/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to ${action} booking (${res.status})`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-pending'] })
    },
  })

  if (pending.length === 0) return null

  return (
    <div className="mb-2 border-b border-[var(--border)] pb-2">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
        Pending approvals ({pending.length})
      </div>
      {pending.map((b) => (
        <div key={b.id} className="px-3 py-2">
          <div className="text-sm text-[var(--fg)] truncate">{b.booker_name}</div>
          <div className="text-[11px] text-[var(--muted)]">
            {linkName(b)} · {whenLabel(b.start_time)}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => act.mutate({ id: b.id, action: 'approve' })}
              disabled={act.isPending}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--bg)] disabled:opacity-50"
              style={{ backgroundColor: 'var(--success)' }}
              aria-label={`Approve booking from ${b.booker_name}`}
            >
              <Check size={11} /> Approve
            </button>
            <button
              type="button"
              onClick={() => act.mutate({ id: b.id, action: 'decline' })}
              disabled={act.isPending}
              className="flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--destructive)] disabled:opacity-50"
              aria-label={`Decline booking from ${b.booker_name}`}
            >
              <X size={11} /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BookingPanel({ onNewLink }: { onNewLink: () => void }) {
  const { data: links = [], isLoading, isError } = useQuery({
    queryKey: ['booking-links'],
    queryFn: async (): Promise<BookingLink[]> => {
      const res = await fetch('/api/booking-links')
      if (!res.ok) throw new Error(`Failed to load booking links (${res.status})`)
      const data = await res.json()
      return (Array.isArray(data) ? data : (data?.items ?? [])) as BookingLink[]
    },
  })

  const publicLinks = links.filter((l) => l.is_public)
  const privateLinks = links.filter((l) => !l.is_public)

  return (
    <div
      className="h-full overflow-y-auto flex flex-col"
      style={{ backgroundColor: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          <CalendarClock size={13} />
          Booking Links
        </div>
        <button
          type="button"
          onClick={onNewLink}
          aria-label="New booking link"
          title="New booking link"
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded',
            'text-[var(--muted)] hover:text-[var(--fg)]',
            'hover:bg-[var(--surface-hover)] transition-colors duration-150'
          )}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <PendingApprovals />

        {isLoading && (
          <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">Loading…</div>
        )}

        {isError && (
          <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">
            Couldn’t load booking links.
          </div>
        )}

        {!isLoading && !isError && links.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">
            No booking links yet.
            <button
              type="button"
              onClick={onNewLink}
              className="mt-2 block w-full text-[var(--accent)] hover:underline"
            >
              Create your first link
            </button>
          </div>
        )}

        {publicLinks.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Public
            </div>
            {publicLinks.map((l) => (
              <LinkRow key={l.id} link={l} />
            ))}
          </div>
        )}

        {privateLinks.length > 0 && (
          <div className="mb-2">
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Private
            </div>
            {privateLinks.map((l) => (
              <LinkRow key={l.id} link={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
