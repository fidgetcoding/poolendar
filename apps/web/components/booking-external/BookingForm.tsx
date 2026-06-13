'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface BookingFormProps {
  onSubmit: (data: { name: string; email: string; notes: string }) => void
  loading: boolean
}

export function BookingForm({ onSubmit, loading }: BookingFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({ name: name.trim(), email: email.trim(), notes: notes.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="John Doe"
        required
        autoComplete="name"
      />
      <Input
        label="Email address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="john@example.com"
        required
        autoComplete="email"
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[var(--fg)]">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the host should know..."
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
        />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? 'Booking...' : 'Confirm Booking'}
      </Button>
    </form>
  )
}
